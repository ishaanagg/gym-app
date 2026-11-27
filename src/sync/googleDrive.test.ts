import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GymExportData } from '../types/gym';
import { GoogleDriveBackupProvider } from './googleDrive';

const sampleBackup: GymExportData = {
  version: 1,
  exportedAt: '2026-11-26T12:00:00Z',
  equipment: [],
  exercises: [],
  sessions: [],
  progress: [],
  settings: { userName: 'John', gymName: 'The Arden', onboardingCompleted: true },
};

describe('GoogleDriveBackupProvider', () => {
  const revokeSpy = vi.fn();

  beforeEach(() => {
    revokeSpy.mockReset();
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: (cfg) => ({
            requestAccessToken: () => {
              cfg.callback({ access_token: 'mock-access-token', expires_in: 3600 });
            },
          }),
          revoke: revokeSpy,
        },
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.google;
  });

  it('reports unconfigured and refuses connect when clientId is blank', async () => {
    const provider = new GoogleDriveBackupProvider('   ');
    expect(provider.isConfigured()).toBe(false);
    await expect(provider.connect()).rejects.toThrow(/not configured/);
  });

  it('creates a new file with POST when no Drive backup exists, and updates in-place with PATCH when one exists', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    // 1st backup: search returns empty -> POST multipart upload
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ modifiedTime: '2026-11-26T12:05:00Z' }), { status: 200 })
      );

    const provider = new GoogleDriveBackupProvider('client-123.apps.googleusercontent.com');
    await provider.connect();
    expect(provider.isConnected()).toBe(true);

    const first = await provider.backup(sampleBackup);
    expect(first.savedAt).toBe('2026-11-26T12:05:00Z');
    expect(fetchMock.mock.calls[1][1]?.method).toBe('POST');

    // 2nd backup: search finds existing file id -> PATCH multipart update
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ files: [{ id: 'drive-file-42', modifiedTime: '2026-11-26T12:05:00Z' }] }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ modifiedTime: '2026-11-26T12:10:00Z' }), { status: 200 })
      );

    const second = await provider.backup(sampleBackup);
    expect(second.savedAt).toBe('2026-11-26T12:10:00Z');
    expect(String(fetchMock.mock.calls[3][0])).toContain('drive-file-42');
    expect(fetchMock.mock.calls[3][1]?.method).toBe('PATCH');
  });

  it('restores backup JSON when present and returns null when Drive appDataFolder is empty', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const provider = new GoogleDriveBackupProvider('client-123.apps.googleusercontent.com');

    // Empty Drive
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }));
    expect(await provider.restore()).toBeNull();

    // Existing Drive backup
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ files: [{ id: 'file-99', modifiedTime: '2026-11-26T12:00:00Z' }] }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(sampleBackup), { status: 200 }));

    const restored = await provider.restore();
    expect(restored?.settings?.userName).toBe('John');
  });

  it('clears expired token on HTTP 401 and revokes token on disconnect()', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const provider = new GoogleDriveBackupProvider('client-123.apps.googleusercontent.com');
    await provider.connect();

    fetchMock.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
    await expect(provider.restore()).rejects.toThrow(/expired/);
    expect(provider.isConnected()).toBe(false);

    await provider.connect();
    provider.disconnect();
    expect(revokeSpy).toHaveBeenCalledWith('mock-access-token');
    expect(provider.isConnected()).toBe(false);
  });
});
