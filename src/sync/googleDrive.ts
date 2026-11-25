import type { GymExportData } from '../types/gym';
import type { BackupProvider } from './backupProvider';

/**
 * Google Drive backup using Google Identity Services (browser token flow) and the
 * `drive.appdata` scope. The backup lives in the app's hidden appDataFolder: Kinetic can
 * only see its own file, never the rest of the user's Drive. No backend or client secret.
 *
 * Tokens are held in memory only (they expire after ~1 hour) and are never persisted.
 */

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'kinetic-backup.json';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (resp: TokenResponse) => void;
    error_callback?: (err: { type: string; message?: string }) => void;
  }): TokenClient;
  revoke(token: string, done?: () => void): void;
}

declare global {
  interface Window {
    google?: { accounts: { oauth2: GoogleOAuth2 } };
  }
}

let gisPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GIS_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        gisPromise = null;
        reject(new Error('Could not load Google sign-in. Check your connection.'));
      };
      document.head.appendChild(script);
    });
  }
  return gisPromise;
}

export class GoogleDriveBackupProvider implements BackupProvider {
  readonly id = 'google-drive';
  readonly label = 'Google Drive';

  private accessToken: string | null = null;
  private expiresAt = 0;
  private tokenClient: TokenClient | null = null;
  private pending: { resolve: () => void; reject: (e: Error) => void } | null = null;
  private readonly clientId: string | undefined;

  constructor(clientId: string | undefined) {
    this.clientId = clientId?.trim() || undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.clientId);
  }

  isConnected(): boolean {
    return Boolean(this.accessToken) && Date.now() < this.expiresAt - 60_000;
  }

  async connect(): Promise<void> {
    if (!this.clientId) throw new Error('Google Drive backup is not configured for this build.');
    await loadGis();
    const oauth2 = window.google!.accounts.oauth2;

    if (!this.tokenClient) {
      this.tokenClient = oauth2.initTokenClient({
        client_id: this.clientId,
        scope: SCOPE,
        callback: (resp) => {
          const p = this.pending;
          this.pending = null;
          if (resp.error || !resp.access_token) {
            p?.reject(new Error(resp.error_description || resp.error || 'Google sign-in failed.'));
            return;
          }
          this.accessToken = resp.access_token;
          this.expiresAt = Date.now() + (resp.expires_in ?? 3600) * 1000;
          p?.resolve();
        },
        error_callback: (err) => {
          const p = this.pending;
          this.pending = null;
          p?.reject(new Error(err.message || `Google sign-in ${err.type}.`));
        },
      });
    }

    await new Promise<void>((resolve, reject) => {
      this.pending = { resolve, reject };
      // Empty prompt = no consent screen if the user already granted access.
      this.tokenClient!.requestAccessToken({ prompt: '' });
    });
  }

  disconnect(): void {
    if (this.accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(this.accessToken);
    }
    this.accessToken = null;
    this.expiresAt = 0;
  }

  private async ensureToken(): Promise<string> {
    if (!this.isConnected()) await this.connect();
    return this.accessToken!;
  }

  private async driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.ensureToken();
    const res = await fetch(url, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      this.accessToken = null;
      throw new Error('Google session expired. Tap Connect again.');
    }
    if (!res.ok) {
      throw new Error(`Google Drive error (${res.status}).`);
    }
    return res;
  }

  private async findFile(): Promise<{ id: string; modifiedTime: string } | null> {
    const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
    const res = await this.driveFetch(
      `${DRIVE_FILES}?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc&pageSize=1`
    );
    const body = (await res.json()) as { files?: { id: string; modifiedTime: string }[] };
    return body.files?.[0] ?? null;
  }

  async backup(data: GymExportData): Promise<{ savedAt: string }> {
    const existing = await this.findFile();
    const boundary = `kinetic-${Date.now().toString(36)}`;
    const metadata = existing ? {} : { name: FILE_NAME, parents: ['appDataFolder'] };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
      `${JSON.stringify(data)}\r\n--${boundary}--`;

    const url = existing
      ? `${DRIVE_UPLOAD}/${existing.id}?uploadType=multipart&fields=modifiedTime`
      : `${DRIVE_UPLOAD}?uploadType=multipart&fields=modifiedTime`;

    const res = await this.driveFetch(url, {
      method: existing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    const meta = (await res.json()) as { modifiedTime?: string };
    return { savedAt: meta.modifiedTime ?? new Date().toISOString() };
  }

  async restore(): Promise<GymExportData | null> {
    const file = await this.findFile();
    if (!file) return null;
    const res = await this.driveFetch(`${DRIVE_FILES}/${file.id}?alt=media`);
    return (await res.json()) as GymExportData;
  }

  async getLastBackupTime(): Promise<string | null> {
    const file = await this.findFile();
    return file?.modifiedTime ?? null;
  }
}

const DEFAULT_GOOGLE_CLIENT_ID =
  '319705740685-33lnao83bei408m42hs7ak2o3ik955q5.apps.googleusercontent.com';

export const googleDriveBackup = new GoogleDriveBackupProvider(
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || DEFAULT_GOOGLE_CLIENT_ID
);
