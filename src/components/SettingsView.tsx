import React, { useEffect, useRef, useState } from 'react';
import { Check, Cloud, CloudOff, Download, RotateCcw, Share2, Upload, User } from 'lucide-react';
import { storageRepo } from '../db/storage';
import { shareOrDownloadBackup } from '../sync/backupProvider';
import { googleDriveBackup } from '../sync/googleDrive';
import type { AppSettings, GymExportData } from '../types/gym';

interface SettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (next: AppSettings) => Promise<void>;
  onDataRestored: () => Promise<void>;
}

type Status = { kind: 'ok' | 'error'; text: string } | null;

interface PendingRestore {
  sourceLabel: string;
  data: GymExportData;
}

function formatTime(iso?: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onDataRestored,
}) => {
  const [userName, setUserName] = useState(settings.userName);
  const [gymName, setGymName] = useState(settings.gymName);
  const [savedFlash, setSavedFlash] = useState(false);

  const [driveConnected, setDriveConnected] = useState(googleDriveBackup.isConnected());
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveStatus, setDriveStatus] = useState<Status>(null);

  const [localStatus, setLocalStatus] = useState<Status>(null);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  const driveConfigured = googleDriveBackup.isConfigured();

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  const scheduleAutoSave = (nextName: string, nextGym: string) => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void onSaveSettings({
        ...settings,
        userName: nextName.trim(),
        gymName: nextGym.trim() || 'My Building Gym',
      });
      setSavedFlash(true);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = window.setTimeout(() => setSavedFlash(false), 1600);
    }, 350);
  };

  const runDrive = async (action: () => Promise<void>) => {
    setDriveBusy(true);
    setDriveStatus(null);
    try {
      await action();
    } catch (err) {
      setDriveStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setDriveConnected(googleDriveBackup.isConnected());
      setDriveBusy(false);
    }
  };

  const connectDrive = () =>
    runDrive(async () => {
      await googleDriveBackup.connect();
      const last = await googleDriveBackup.getLastBackupTime();
      await onSaveSettings({
        ...settings,
        userName: userName.trim(),
        gymName: gymName.trim() || 'My Building Gym',
        driveBackupEnabled: true,
        lastCloudBackupAt: last ?? settings.lastCloudBackupAt,
      });
      setDriveStatus({
        kind: 'ok',
        text: last ? `Connected. Last Drive backup: ${formatTime(last)}.` : 'Connected. Ready to back up.',
      });
    });

  const backupToDrive = () =>
    runDrive(async () => {
      const data = await storageRepo.exportAll();
      const { savedAt } = await googleDriveBackup.backup(data);
      await onSaveSettings({
        ...settings,
        userName: userName.trim(),
        gymName: gymName.trim() || 'My Building Gym',
        driveBackupEnabled: true,
        lastCloudBackupAt: savedAt,
      });
      setDriveStatus({ kind: 'ok', text: 'Backed up to Google Drive.' });
    });

  const restoreFromDrive = () =>
    runDrive(async () => {
      const data = await googleDriveBackup.restore();
      if (!data) {
        setDriveStatus({ kind: 'error', text: 'No Kinetic backup found in this Google account.' });
        return;
      }
      setPendingRestore({
        sourceLabel: `Google Drive backup (${formatTime(data.exportedAt)})`,
        data,
      });
    });

  const confirmRestore = async () => {
    if (!pendingRestore) return;
    const isDrive = pendingRestore.sourceLabel.startsWith('Google Drive');
    try {
      await storageRepo.importAll(pendingRestore.data);
      await onDataRestored();
      if (pendingRestore.data.settings) {
        setUserName(pendingRestore.data.settings.userName);
        setGymName(pendingRestore.data.settings.gymName);
      }
      const msg: Status = { kind: 'ok', text: 'Backup restored on this device.' };
      if (isDrive) setDriveStatus(msg);
      else setLocalStatus(msg);
    } catch (err) {
      const msg: Status = {
        kind: 'error',
        text: err instanceof Error ? err.message : 'Could not restore backup.',
      };
      if (isDrive) setDriveStatus(msg);
      else setLocalStatus(msg);
    } finally {
      setPendingRestore(null);
    }
  };

  const disconnectDrive = async () => {
    googleDriveBackup.disconnect();
    setDriveConnected(false);
    await onSaveSettings({ ...settings, driveBackupEnabled: false });
    setDriveStatus({ kind: 'ok', text: 'Disconnected. Your Drive backup was not deleted.' });
  };

  const handleShare = async () => {
    try {
      const data = await storageRepo.exportAll();
      const how = await shareOrDownloadBackup(data);
      setLocalStatus({ kind: 'ok', text: how === 'shared' ? 'Backup shared.' : 'Backup downloaded.' });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setLocalStatus({ kind: 'error', text: 'Could not create backup.' });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as GymExportData;
      if (!parsed || parsed.version !== 1) {
        throw new Error('Unsupported backup file format.');
      }
      setPendingRestore({
        sourceLabel: `file "${file.name}" (${formatTime(parsed.exportedAt)})`,
        data: parsed,
      });
    } catch (err) {
      setLocalStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Invalid backup file.' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const statusLine = (s: Status) =>
    s && (
      <p
        className="exercise-meta"
        style={{ marginTop: 10, color: s.kind === 'ok' ? 'var(--accent-emerald-bright)' : '#fda4af' }}
        role="status"
      >
        {s.text}
      </p>
    );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Stored privately on your phone unless you choose to back up.</p>
      </div>

      {/* Auto-Saving Profile */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={14} /> Profile
          </span>
          {savedFlash && (
            <span className="badge badge-emerald">
              <Check size={11} /> Saved
            </span>
          )}
        </div>

        <div>
          <label htmlFor="settings-user-name" className="section-label" style={{ display: 'block', marginBottom: 6 }}>
            Your name
          </label>
          <input
            id="settings-user-name"
            className="input-field"
            value={userName}
            onChange={(e) => {
              const next = e.target.value;
              setUserName(next);
              scheduleAutoSave(next, gymName);
            }}
            placeholder="e.g., Ishaan"
            maxLength={40}
            autoComplete="given-name"
          />
        </div>

        <div>
          <label htmlFor="settings-gym-name" className="section-label" style={{ display: 'block', marginBottom: 6 }}>
            Building / gym name
          </label>
          <input
            id="settings-gym-name"
            className="input-field"
            value={gymName}
            onChange={(e) => {
              const next = e.target.value;
              setGymName(next);
              scheduleAutoSave(userName, next);
            }}
            placeholder="e.g., The Arden Fitness Room"
            maxLength={50}
          />
        </div>
      </div>

      {/* Google Drive */}
      <div className="card">
        <div className="card-header">
          <span className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {driveConnected ? <Cloud size={14} /> : <CloudOff size={14} />} Google Drive Backup
          </span>
          {driveConfigured && (
            <span className={`badge ${driveConnected ? 'badge-emerald' : 'badge-slate'}`}>
              {driveConnected ? 'Connected' : settings.driveBackupEnabled ? 'Reconnect' : 'Off'}
            </span>
          )}
        </div>

        {!driveConfigured ? (
          <p className="page-subtitle">
            Use <strong>Share Backup</strong> below and pick <strong>Save to Drive</strong> from your
            phone&apos;s share sheet.
          </p>
        ) : (
          <>
            <p className="page-subtitle" style={{ marginBottom: 12 }}>
              Saves your machines, workouts, and settings to a hidden app folder in your Google
              Drive. Kinetic cannot access any other Drive files.
            </p>
            <div className="exercise-meta" style={{ marginBottom: 12 }}>
              Last backup: <span className="mono">{formatTime(settings.lastCloudBackupAt)}</span>
            </div>

            {!driveConnected ? (
              <button type="button" className="btn btn-primary" onClick={connectDrive} disabled={driveBusy}>
                <Cloud size={16} /> {driveBusy ? 'Connecting…' : 'Connect Google Drive'}
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={backupToDrive} disabled={driveBusy}>
                    <Upload size={16} /> {driveBusy ? 'Working…' : 'Back Up Now'}
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={restoreFromDrive} disabled={driveBusy}>
                    <RotateCcw size={16} /> Restore
                  </button>
                </div>
                <button type="button" className="btn-ghost" onClick={disconnectDrive} style={{ alignSelf: 'flex-start' }}>
                  Disconnect
                </button>
              </div>
            )}
          </>
        )}
        {statusLine(driveStatus)}
      </div>

      {/* Local file backup */}
      <div className="card">
        <div className="card-header">
          <span className="section-label">Backup File</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={handleShare}>
            <Share2 size={16} /> Share Backup
          </button>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => fileInputRef.current?.click()}>
            <Download size={16} /> Restore File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </div>
        {statusLine(localStatus)}
      </div>

      {pendingRestore && (
        <div className="modal-backdrop" onClick={() => setPendingRestore(null)}>
          <div
            className="modal-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div className="sheet-handle" />
            <h2 style={{ margin: 0, fontSize: '1.12rem' }}>Restore Backup?</h2>
            <p className="page-subtitle">
              This will replace all machines, workout history, and settings on this device with your{' '}
              <strong>{pendingRestore.sourceLabel}</strong>.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setPendingRestore(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={confirmRestore}
              >
                Restore Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
