import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Dumbbell, Flame } from 'lucide-react';
import { MyGymView } from './components/MyGymView';
import { ProgressView } from './components/ProgressView';
import { TodayView } from './components/TodayView';
import { WorkoutPlayer } from './components/WorkoutPlayer';
import { storageRepo } from './db/storage';
import {
  buildPlannedExercise,
  computeUpdatedProgress,
  generateWorkoutSession,
} from './engine/workoutGenerator';
import type {
  BlockType,
  Equipment,
  Exercise,
  ExerciseProgress,
  SessionDuration,
  WorkoutSession,
} from './types/gym';

type Tab = 'today' | 'progress' | 'gym';

export function App() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [duration, setDuration] = useState<SessionDuration>(30);

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [progress, setProgress] = useState<Record<string, ExerciseProgress>>({});

  const [plannedSession, setPlannedSession] = useState<WorkoutSession | null>(null);
  const [inProgressSession, setInProgressSession] = useState<WorkoutSession | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const hydrateFromStorage = useCallback(async () => {
    const data = await storageRepo.initializeAndLoad();
    setEquipment(data.equipment);
    setExercises(data.exercises);
    setSessions(data.sessions);
    setProgress(data.progress);
    setInProgressSession(data.activeSession);
    setPlannedSession(
      generateWorkoutSession(30, data.equipment, data.exercises, data.sessions, data.progress)
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void hydrateFromStorage();
  }, [hydrateFromStorage]);

  const handleChangeDuration = (newDuration: SessionDuration) => {
    setDuration(newDuration);
    setPlannedSession(
      generateWorkoutSession(newDuration, equipment, exercises, sessions, progress)
    );
  };

  const handleRegenerate = () => {
    setPlannedSession(
      generateWorkoutSession(duration, equipment, exercises, sessions, progress)
    );
  };

  const handleSwapExercise = (
    blockType: BlockType,
    instanceId: string,
    newExercise: Exercise
  ) => {
    if (!plannedSession) return;
    const eqMap = new Map(equipment.map((e) => [e.id, e]));

    setPlannedSession({
      ...plannedSession,
      blocks: plannedSession.blocks.map((b) => {
        if (b.type !== blockType) return b;
        return {
          ...b,
          exercises: b.exercises.map((pe) => {
            if (pe.instanceId !== instanceId) return pe;
            return buildPlannedExercise(newExercise, eqMap, progress, pe.sets.length);
          }),
        };
      }),
    });
  };

  const handleStartWorkout = async () => {
    if (!plannedSession) return;
    const started: WorkoutSession = { ...plannedSession, status: 'in_progress' };
    setPlannedSession(started);
    setInProgressSession(started);
    setIsPlaying(true);
    await storageRepo.saveActiveSession(started);
  };

  const handleResumeWorkout = () => {
    if (!inProgressSession) return;
    setPlannedSession(inProgressSession);
    setIsPlaying(true);
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

    const updatedProgress = { ...progress };
    for (const block of finalized.blocks) {
      for (const pe of block.exercises) {
        const hasActivity = pe.effort || pe.sets.some((s) => s.completed);
        if (!hasActivity) continue;
        const nextEntry = computeUpdatedProgress(pe, pe.effort ?? 'just_right');
        const prevCount = updatedProgress[pe.exerciseId]?.totalSessions ?? 0;
        nextEntry.totalSessions = prevCount + 1;
        updatedProgress[pe.exerciseId] = nextEntry;
        await storageRepo.saveExerciseProgress(nextEntry);
      }
    }

    setSessions([finalized, ...sessions]);
    setProgress(updatedProgress);
    setInProgressSession(null);
    setPlannedSession(finalized);
  };

  const handleSaveEquipment = async (item: Equipment) => {
    await storageRepo.saveEquipment(item);
    const exists = equipment.some((e) => e.id === item.id);
    const nextEq = exists
      ? equipment.map((e) => (e.id === item.id ? item : e))
      : [...equipment, item];
    setEquipment(nextEq);
    setPlannedSession(
      generateWorkoutSession(duration, nextEq, exercises, sessions, progress)
    );
  };

  const handleSaveExercise = async (ex: Exercise) => {
    await storageRepo.saveExercise(ex);
    const nextExercises = [...exercises, ex];
    setExercises(nextExercises);
    setPlannedSession(
      generateWorkoutSession(duration, equipment, nextExercises, sessions, progress)
    );
  };

  const handleExitPlayer = () => {
    setIsPlaying(false);
    setPlannedSession(
      generateWorkoutSession(duration, equipment, exercises, sessions, progress)
    );
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-mark">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="GymCoPilot" width={30} height={30} />
          <div>
            <div className="brand-title">GymCoPilot</div>
            <div className="brand-sub">Building Gym · lbs</div>
          </div>
        </div>
        {isPlaying && <span className="badge badge-emerald">In Session</span>}
      </header>

      <main className="main-content">
        {loading || !plannedSession ? (
          <div className="card">
            <p className="page-subtitle">Loading your building gym profile...</p>
          </div>
        ) : isPlaying ? (
          <WorkoutPlayer
            session={plannedSession}
            equipment={equipment}
            exercises={exercises}
            onUpdateSession={handleUpdateActiveSession}
            onFinishWorkout={handleFinishWorkout}
            onExit={handleExitPlayer}
          />
        ) : activeTab === 'today' ? (
          <TodayView
            duration={duration}
            onChangeDuration={handleChangeDuration}
            session={plannedSession}
            inProgressSession={inProgressSession}
            equipment={equipment}
            exercises={exercises}
            onRegenerate={handleRegenerate}
            onSwapExercise={handleSwapExercise}
            onStartWorkout={handleStartWorkout}
            onResumeWorkout={handleResumeWorkout}
            onDiscardInProgress={handleDiscardInProgress}
          />
        ) : activeTab === 'progress' ? (
          <ProgressView
            sessions={sessions}
            progress={progress}
            exercises={exercises}
            equipment={equipment}
            onDataImported={hydrateFromStorage}
          />
        ) : (
          <MyGymView
            equipment={equipment}
            exercises={exercises}
            onSaveEquipment={handleSaveEquipment}
            onSaveExercise={handleSaveExercise}
          />
        )}
      </main>

      {!isPlaying && (
        <nav className="bottom-nav" aria-label="Main navigation">
          <div className="bottom-nav-inner">
            <button
              type="button"
              className={`nav-item ${activeTab === 'today' ? 'active' : ''}`}
              onClick={() => setActiveTab('today')}
            >
              <Flame size={20} />
              <span>Today</span>
            </button>
            <button
              type="button"
              className={`nav-item ${activeTab === 'progress' ? 'active' : ''}`}
              onClick={() => setActiveTab('progress')}
            >
              <BarChart3 size={20} />
              <span>Progress</span>
            </button>
            <button
              type="button"
              className={`nav-item ${activeTab === 'gym' ? 'active' : ''}`}
              onClick={() => setActiveTab('gym')}
            >
              <Dumbbell size={20} />
              <span>My Gym</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

export default App;
