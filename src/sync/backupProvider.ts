import type { GymExportData } from '../types/gym';

/**
 * Cloud backup abstraction. UI talks to this interface only, so adding iCloud / Dropbox /
 * a real sync backend later doesn't touch React components.
 */
export interface BackupProvider {
  readonly id: string;
  readonly label: string;
  /** True when the provider has the build-time config it needs (e.g. OAuth client id). */
  isConfigured(): boolean;
  /** Must be called from a user gesture the first time (opens the consent popup). */
  connect(): Promise<void>;
  disconnect(): void;
  /** True while a usable access token is held in memory. */
  isConnected(): boolean;
  backup(data: GymExportData): Promise<{ savedAt: string }>;
  /** Returns null when no backup exists yet. */
  restore(): Promise<GymExportData | null>;
  getLastBackupTime(): Promise<string | null>;
}

export function backupFileName(date = new Date()): string {
  return `kinetic-backup-${date.toISOString().slice(0, 10)}.json`;
}

/**
 * Zero-setup option: hand the backup file to the OS share sheet (on phones you can pick
 * "Save to Drive", Files, email, etc.). Falls back to a regular download on desktop.
 */
export async function shareOrDownloadBackup(data: GymExportData): Promise<'shared' | 'downloaded'> {
  const json = JSON.stringify(data, null, 2);
  const name = backupFileName();
  const file = new File([json], name, { type: 'application/json' });

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Kinetic backup' });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      // Otherwise fall through to download
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
