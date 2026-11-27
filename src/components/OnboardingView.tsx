import React, { useState } from 'react';
import { ArrowRight, Check, Cloud, Dumbbell, RefreshCw, RotateCcw, ShieldCheck, WifiOff } from 'lucide-react';
import { storageRepo } from '../db/storage';
import { googleDriveBackup } from '../sync/googleDrive';
import type { AppSettings } from '../types/gym';
import { useBackGuard } from '../utils/backNavigation';
import { triggerHaptic } from '../utils/ux';

interface OnboardingViewProps {
  initialSettings: AppSettings;
  onComplete: (nextSettings: AppSettings) => Promise<void>;
  onRestoredFromDrive: () => Promise<void>;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({
  initialSettings,
  onComplete,
  onRestoredFromDrive,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [userName, setUserName] = useState(initialSettings.userName);
  const [gymName, setGymName] = useState(
    initialSettings.gymName === 'My Building Gym' ? '' : initialSettings.gymName
  );
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useBackGuard(step === 2 && !busy, () => setStep(1), { priority: 'tab' });

  const driveConfigured = googleDriveBackup.isConfigured();

  const resolvedSettings = (extra?: Partial<AppSettings>): AppSettings => ({
    ...initialSettings,
    userName: userName.trim(),
    gymName: gymName.trim() || 'My Building Gym',
    onboardingCompleted: true,
    ...extra,
  });

  const handleStepOneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(10);
    setErrorMsg(null);
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConnectDriveAndFinish = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      triggerHaptic(12);
      // Run connect() immediately on user tap so mobile browsers never block the OAuth popup
      await googleDriveBackup.connect();

      const next = resolvedSettings({ driveBackupEnabled: true });
      await storageRepo.saveSettings(next);
      const payload = await storageRepo.exportAll();
      const { savedAt } = await googleDriveBackup.backup({
        ...payload,
        settings: next,
      });
      await onComplete({ ...next, lastCloudBackupAt: savedAt });
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? `${err.message} You can retry or tap "Set Up Later in Settings" below.`
          : 'Could not connect Google Drive right now. You can set it up later in Settings.'
      );
      setBusy(false);
    }
  };

  const handleSkipDrive = async () => {
    triggerHaptic(8);
    await onComplete(resolvedSettings());
  };

  const handleRestoreExisting = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await googleDriveBackup.connect();
      const backup = await googleDriveBackup.restore();
      if (!backup) {
        setErrorMsg('No existing Kinetic backup was found in that Google account.');
        setBusy(false);
        return;
      }
      await storageRepo.importAll({
        ...backup,
        settings: {
          userName: backup.settings?.userName ?? '',
          gymName: backup.settings?.gymName ?? 'My Building Gym',
          ...backup.settings,
          onboardingCompleted: true,
          driveBackupEnabled: true,
        },
      });
      await onRestoredFromDrive();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not restore from Google Drive.');
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - 36px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 20,
        paddingTop: 12,
      }}
    >
      {/* Step Dots */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="brand-mark">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="Kinetic" width={32} height={32} />
          <span className="brand-title">Kinetic</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }} aria-label={`Step ${step} of 2`}>
          <span
            style={{
              width: step === 1 ? 20 : 8,
              height: 6,
              borderRadius: 999,
              background: step === 1 ? 'var(--accent-emerald)' : 'var(--bg-interactive)',
              transition: 'all 0.2s ease',
            }}
          />
          <span
            style={{
              width: step === 2 ? 20 : 8,
              height: 6,
              borderRadius: 999,
              background: step === 2 ? 'var(--accent-emerald)' : 'var(--bg-interactive)',
              transition: 'all 0.2s ease',
            }}
          />
        </div>
      </div>

      {step === 1 ? (
        <form
          onSubmit={handleStepOneSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}
        >
          <div>
            <h1 className="page-title" style={{ fontSize: '1.75rem', marginBottom: 6 }}>
              Personal workouts built for your building&apos;s gym.
            </h1>
            <p className="page-subtitle">
              Functional strength, mobility, core, and cardio — scaled to the time you have.
            </p>
          </div>

          {/* Value Pillars + Offline Promise */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Dumbbell size={18} color="var(--accent-emerald-bright)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Tailored to your exact gear</div>
                <div className="exercise-meta">
                  Adapts to the machines and exact weight plates in your gym — add or remove equipment anytime.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <RefreshCw size={18} color="var(--accent-emerald-bright)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Smart rotation &amp; progression</div>
                <div className="exercise-meta">
                  Balances every session around your last 2 workouts with posture cues and gradual strength gains.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <WifiOff size={18} color="#fbbf24" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Works 100% offline</div>
                <div className="exercise-meta">
                  All workouts and progress live locally on your phone — reliable even in basement gyms with zero signal.
                </div>
              </div>
            </div>
          </div>

          {/* Personalization Inputs */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label htmlFor="onboard-name" className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                What should we call you?
              </label>
              <input
                id="onboard-name"
                className="input-field"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Your first name (e.g., John)"
                maxLength={40}
                autoComplete="given-name"
              />
            </div>

            <div>
              <label htmlFor="onboard-gym" className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                Building or gym name
              </label>
              <input
                id="onboard-gym"
                className="input-field"
                value={gymName}
                onChange={(e) => setGymName(e.target.value)}
                placeholder="e.g., The Arden Fitness Room"
                maxLength={50}
              />
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Continue <ArrowRight size={18} />
            </button>

            {driveConfigured && (
              <button
                type="button"
                className="btn-ghost"
                style={{ alignSelf: 'center' }}
                onClick={handleRestoreExisting}
                disabled={busy}
              >
                <RotateCcw size={14} /> {busy ? 'Checking Drive…' : 'Already have a Google Drive backup? Restore'}
              </button>
            )}
            {errorMsg && (
              <p className="exercise-meta" style={{ color: '#fda4af', textAlign: 'center', margin: 0 }}>
                {errorMsg}
              </p>
            )}
          </div>
        </form>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
          <div>
            <span className="badge badge-emerald" style={{ marginBottom: 8 }}>
              Recommended
            </span>
            <h1 className="page-title" style={{ fontSize: '1.7rem', marginBottom: 6 }}>
              Turn on Google Drive Backup
            </h1>
            <p className="page-subtitle">
              Because Kinetic runs offline with zero servers, your workout history and custom gym
              machines live on this phone. Turning on Drive Backup keeps everything safe if you
              ever switch phones or clear browser storage.
            </p>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Cloud size={18} color="var(--accent-emerald-bright)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Automatic post-workout sync</div>
                <div className="exercise-meta">
                  Backs up your progress, custom machines, weight stacks, and settings automatically when connected.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <ShieldCheck size={18} color="var(--accent-emerald-bright)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Private app-only folder</div>
                <div className="exercise-meta">
                  Stored in your own Google Drive&apos;s hidden app folder. Kinetic cannot see any of your other files.
                </div>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div
              className="card"
              style={{ borderColor: 'rgba(244, 63, 94, 0.35)', background: 'var(--accent-rose-soft)' }}
            >
              <p className="exercise-meta" style={{ color: '#fda4af', margin: 0 }}>
                {errorMsg}
              </p>
            </div>
          )}

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {driveConfigured && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConnectDriveAndFinish}
                disabled={busy}
              >
                <Cloud size={18} />
                {busy ? 'Connecting Google Drive…' : 'Turn On Google Drive Backup'}
              </button>
            )}

            <button
              type="button"
              className={driveConfigured ? 'btn btn-secondary' : 'btn btn-primary'}
              onClick={handleSkipDrive}
              disabled={busy}
            >
              <Check size={17} />
              {driveConfigured ? 'Set Up Later in Settings' : 'Start Using Kinetic'}
            </button>

            <button
              type="button"
              className="btn-ghost"
              style={{ alignSelf: 'center' }}
              onClick={() => {
                setErrorMsg(null);
                setStep(1);
              }}
              disabled={busy}
            >
              ← Back to Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
