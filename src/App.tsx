import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Dumbbell, Flame, Settings as SettingsIcon } from 'lucide-react';
import { MyGymView } from './components/MyGymView';
import { OnboardingView } from './components/OnboardingView';
import { ProgressView } from './components/ProgressView';
import { SettingsView } from './components/SettingsView';
import { TodayView } from './components/TodayView';
import { WorkoutPlayer } from './components/WorkoutPlayer';
import { buildExercisesForEquipment } from './data/knowledgeBase';
import { DEFAULT_SETTINGS, storageRepo } from './db/storage';
import {
  buildPlannedExercise,
  computeUpdatedProgress,
  generateWorkoutSession,
} from './engine/workoutGenerator';
import { googleDriveBackup } from './sync/googleDrive';
import type {
  AppSettings,
  BlockType,
  Equipment,
  Exercise,
  ExerciseProgress,
  SessionDuration,
  SessionIntensity,
  TargetArea,
  WorkoutSession,
} from './types/gym';
import { triggerHaptic } from './utils/ux';

type Tab = 'today' | 'progress' | 'gym' | 'settings';

export function App() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [duration, setDuration] = useState<SessionDuration>(30);
  const [intensity, setIntensity] = useState<SessionIntensity>('medium');
  const [targets, setTargets] = useState<TargetArea[]>([]);

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [progress, setProgress] = useState<Record<string, ExerciseProgress>>({});
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const [plannedSession, setPlannedSession] = useState<WorkoutSession | null>(null);
  const [inProgressSession, setInProgressSession] = useState<WorkoutSession | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const applyLoadedState = useCallback(
    (data: Awaited<ReturnType<typeof storageRepo.initializeAndLoad>>) => {
      const alreadyActive =
        Boolean(data.settings.onboardingCompleted) ||
        data.sessions.length > 0 ||
        Boolean(data.settings.userName) ||
        data.settings.gymName !== 'My Building Gym';

      setEquipment(data.equipment);
      setExercises(data.exercises);
      setSessions(data.sessions);
      setProgress(data.progress);
      setInProgressSession(data.activeSession);
      setSettings({ ...data.settings, onboardingCompleted: alreadyActive });
      setPlannedSession(
        generateWorkoutSession(
          30,
          data.equipment,
          data.exercises,
          data.sessions,
          data.progress,
          Math.random,
          () => new Date(),
          { targets: [], intensity: 'medium' }
        )
      );
      setLoading(false);
    },
    []
  );

  const hydrateFromStorage = useCallback(async () => {
    const data = await storageRepo.initializeAndLoad();
    applyLoadedState(data);
  }, [applyLoadedState]);

  useEffect(() => {
    let active = true;
    storageRepo.initializeAndLoad().then((data) => {
      if (active) applyLoadedState(data);
    });
    return () => {
      active = false;
    };
  }, [applyLoadedState]);

  const rebuildPlan = (
    nextDuration: SessionDuration,
    nextTargets: TargetArea[],
    nextIntensity: SessionIntensity,
    eqList = equipment,
    exList = exercises
  ) => {
    setPlannedSession(
      generateWorkoutSession(
        nextDuration,
        eqList,
        exList,
        sessions,
        progress,
        Math.random,
        () => new Date(),
        { targets: nextTargets, intensity: nextIntensity }
      )
    );
  };

  const handleChangeDuration = (newDuration: SessionDuration) => {
    setDuration(newDuration);
    rebuildPlan(newDuration, targets, intensity);
  };

  const handleChangeIntensity = (newIntensity: SessionIntensity) => {
    setIntensity(newIntensity);
    rebuildPlan(duration, targets, newIntensity);
  };

  const handleToggleTarget = (area: TargetArea) => {
    const nextTargets = targets.includes(area)
      ? targets.filter((t) => t !== area)
      : [...targets, area];
    setTargets(nextTargets);
    rebuildPlan(duration, nextTargets, intensity);
  };

  const handleClearTargets = () => {
    setTargets([]);
    rebuildPlan(duration, [], intensity);
  };

  const handleRegenerate = () => {
    rebuildPlan(duration, targets, intensity);
  };

  const handleSwapExercise = (
    blockType: BlockType,
    instanceId: string,
    newExercise: Exercise
  ) => {
    if (!plannedSession) return;
    const eqMap = new Map(equipment.map((e) => [e.id, e]));
    const activeIntensity = plannedSession.intensity ?? intensity;

    const updated: WorkoutSession = {
      ...plannedSession,
      blocks: plannedSession.blocks.map((b) => {
        if (b.type !== blockType) return b;
        return {
          ...b,
          exercises: b.exercises.map((pe) => {
            if (pe.instanceId !== instanceId) return pe;
            return buildPlannedExercise(
              newExercise,
              eqMap,
              progress,
              pe.sets.length,
              Math.random,
              activeIntensity
            );
          }),
        };
      }),
    };

    setPlannedSession(updated);
    if (isPlaying) {
      setInProgressSession(updated);
      void storageRepo.saveActiveSession(updated);
    }
  };

  const handleStartWorkout = async () => {
    if (!plannedSession) return;
    const started: WorkoutSession = { ...plannedSession, status: 'in_progress' };
    setPlannedSession(started);
    setInProgressSession(started);
    setIsPlaying(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await storageRepo.saveActiveSession(started);
  };

  const handleResumeWorkout = () => {
    if (!inProgressSession) return;
    setPlannedSession(inProgressSession);
    setIsPlaying(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDiscardInProgress = async () => {
    setInProgressSession(null);
    await storageRepo.saveActiveSession(null);
  };

  const handleUpdateActiveSession = (updated: WorkoutSession) => {
    setPlannedSession(updated);
    setInProgressSession(updated);
    void storageRepo.saveActiveSession(updated);
  };

  const handleFinishWorkout = async (completed: WorkoutSession) => {
    const finalized: WorkoutSession = { ...completed, status: 'completed' };
    await storageRepo.saveWorkoutSession(finalized);
    await storageRepo.saveActiveSession(null);

    const isLightSession = finalized.intensity === 'light';
    const updatedProgress = { ...progress };

    for (const block of finalized.blocks) {
      if (block.type !== 'strength' && block.type !== 'core') continue;
      for (const pe of block.exercises) {
        const hasActivity = pe.effort || pe.sets.some((s) => s.completed);
        if (!hasActivity) continue;
        const nextEntry = computeUpdatedProgress(pe, pe.effort ?? 'just_right');
        const prevEntry = updatedProgress[pe.exerciseId];
        nextEntry.totalSessions = (prevEntry?.totalSessions ?? 0) + 1;

        // Safeguard: deliberate Light recovery days never overwrite a higher normal working weight downward
        if (isLightSession && prevEntry && prevEntry.currentWeight > nextEntry.currentWeight) {
          nextEntry.currentWeight = prevEntry.currentWeight;
          nextEntry.lastReps = prevEntry.lastReps;
          nextEntry.lastEffort = prevEntry.lastEffort;
        }

        updatedProgress[pe.exerciseId] = nextEntry;
        await storageRepo.saveExerciseProgress(nextEntry);
      }
    }

    const nextSessions = [finalized, ...sessions];
    setSessions(nextSessions);
    setProgress(updatedProgress);
    setInProgressSession(null);
    setPlannedSession(finalized);

    if (settings.driveBackupEnabled && googleDriveBackup.isConnected()) {
      try {
        const { savedAt } = await googleDriveBackup.backup(await storageRepo.exportAll());
        await handleSaveSettings({ ...settings, lastCloudBackupAt: savedAt });
      } catch {
        // Ignore; manual backup remains available in Settings.
      }
    }
  };

  const handleSaveSettings = async (next: AppSettings) => {
    setSettings(next);
    await storageRepo.saveSettings(next);
  };

  const handleDeleteEquipment = async (id: string) => {
    await storageRepo.deleteEquipment(id);
    const nextEq = equipment.filter((e) => e.id !== id);
    const data = await storageRepo.initializeAndLoad();
    setEquipment(nextEq);
    setExercises(data.exercises);
    rebuildPlan(duration, targets, intensity, nextEq, data.exercises);
  };

  const handleSaveEquipment = async (item: Equipment, archetypeId?: string) => {
    await storageRepo.saveEquipment(item);
    const exists = equipment.some((e) => e.id === item.id);
    const nextEq = exists
      ? equipment.map((e) => (e.id === item.id ? item : e))
      : [...equipment, item];

    let nextExercises = exercises;
    if (!exists) {
      const autoExercises = buildExercisesForEquipment(item, exercises, archetypeId);
      if (autoExercises.length > 0) {
        await Promise.all(autoExercises.map((ex) => storageRepo.saveExercise(ex)));
        nextExercises = [...exercises, ...autoExercises];
        setExercises(nextExercises);
      }
    }

    setEquipment(nextEq);
    rebuildPlan(duration, targets, intensity, nextEq, nextExercises);
  };

  const handleSaveExercise = async (ex: Exercise) => {
    await storageRepo.saveExercise(ex);
    const nextExercises = [...exercises, ex];
    setExercises(nextExercises);
    rebuildPlan(duration, targets, intensity, equipment, nextExercises);
  };

  const handleExitPlayer = () => {
    setIsPlaying(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    rebuildPlan(duration, targets, intensity);
  };

  const handleDiscardActiveWorkout = async () => {
    setIsPlaying(false);
    setInProgressSession(null);
    await storageRepo.saveActiveSession(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    rebuildPlan(duration, targets, intensity);
  };

  const switchTab = (tab: Tab) => {
    triggerHaptic(6);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showOnboarding = !loading && !settings.onboardingCompleted;
  const hideChrome = isPlaying || showOnboarding;

  return (
    <div className={`app-shell ${hideChrome ? 'playing' : ''} ${isPlaying ? 'workout-lock' : ''}`}>
      {!hideChrome && (
        <header className="app-header">
          <div className="brand-mark">
            <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="Kinetic" width={30} height={30} />
            <div>
              <div className="brand-title">Kinetic</div>
              <button
                type="button"
                className="brand-sub-btn"
                onClick={() => switchTab('gym')}
                title="Customize your gym"
              >
                {settings.gymName} ›
              </button>
            </div>
          </div>
        </header>
      )}

      <main className="main-content">
        {loading || !plannedSession ? (
          <div className="card">
            <p className="page-subtitle">Preparing your session…</p>
          </div>
        ) : showOnboarding ? (
          <OnboardingView
            initialSettings={settings}
            onComplete={async (nextSettings) => {
              await handleSaveSettings(nextSettings);
              setActiveTab('today');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onRestoredFromDrive={hydrateFromStorage}
          />
        ) : isPlaying ? (
          <WorkoutPlayer
            session={plannedSession}
            equipment={equipment}
            exercises={exercises}
            recentSessions={sessions}
            progress={progress}
            onUpdateSession={handleUpdateActiveSession}
            onSwapExercise={handleSwapExercise}
            onFinishWorkout={handleFinishWorkout}
            onDiscardSession={handleDiscardActiveWorkout}
            onExit={handleExitPlayer}
          />
        ) : activeTab === 'today' ? (
          <TodayView
            duration={duration}
            onChangeDuration={handleChangeDuration}
            intensity={intensity}
            onChangeIntensity={handleChangeIntensity}
            targets={targets}
            onToggleTarget={handleToggleTarget}
            onClearTargets={handleClearTargets}
            session={plannedSession}
            inProgressSession={inProgressSession}
            recentSessions={sessions}
            equipment={equipment}
            exercises={exercises}
            onRegenerate={handleRegenerate}
            onSwapExercise={handleSwapExercise}
            onStartWorkout={handleStartWorkout}
            onResumeWorkout={handleResumeWorkout}
            onDiscardInProgress={handleDiscardInProgress}
            userName={settings.userName}
          />
        ) : activeTab === 'progress' ? (
          <ProgressView
            sessions={sessions}
            progress={progress}
            exercises={exercises}
            equipment={equipment}
          />
        ) : activeTab === 'settings' ? (
          <SettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onDataRestored={hydrateFromStorage}
          />
        ) : (
          <MyGymView
            gymName={settings.gymName}
            equipment={equipment}
            exercises={exercises}
            onSaveEquipment={handleSaveEquipment}
            onSaveExercise={handleSaveExercise}
            onDeleteEquipment={handleDeleteEquipment}
          />
        )}
      </main>

      {!hideChrome && (
        <nav className="bottom-nav" aria-label="Main navigation">
          <div className="bottom-nav-inner">
            <button
              type="button"
              className={`nav-item ${activeTab === 'today' ? 'active' : ''}`}
              onClick={() => switchTab('today')}
            >
              <Flame size={20} />
              <span>Today</span>
            </button>
            <button
              type="button"
              className={`nav-item ${activeTab === 'progress' ? 'active' : ''}`}
              onClick={() => switchTab('progress')}
            >
              <BarChart3 size={20} />
              <span>Momentum</span>
            </button>
            <button
              type="button"
              className={`nav-item ${activeTab === 'gym' ? 'active' : ''}`}
              onClick={() => switchTab('gym')}
            >
              <Dumbbell size={20} />
              <span>My Gym</span>
            </button>
            <button
              type="button"
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => switchTab('settings')}
            >
              <SettingsIcon size={20} />
              <span>Settings</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

export default App;
