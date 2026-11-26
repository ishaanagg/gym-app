import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Timer,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';
import { computeUpdatedProgress, getNextTarget } from '../engine/workoutGenerator';
import type {
  BlockType,
  EffortRating,
  Equipment,
  Exercise,
  ExerciseProgress,
  PlannedExercise,
  WorkoutSession,
} from '../types/gym';
import { formatClock, triggerHaptic, useWakeLock } from '../utils/ux';
import { FormVisual } from './FormVisual';
import { SwapModal } from './SwapModal';

interface TimedSetControlProps {
  durationSec: number;
  completed: boolean;
  onToggleComplete: (forceComplete?: boolean) => void;
}

const TimedSetControl: React.FC<TimedSetControlProps> = ({
  durationSec,
  completed,
  onToggleComplete,
}) => {
  const [remaining, setRemaining] = useState(durationSec);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          setRunning(false);
          triggerHaptic([20, 60, 30]);
          onToggleComplete(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [running, onToggleComplete]);

  const pct = durationSec > 0 ? Math.round(((durationSec - remaining) / durationSec) * 100) : 0;

  return (
    <div className="timer-box">
      <div className="timer-readout">
        <div>
          <div className="section-label" style={{ marginBottom: 4 }}>
            Guided Timer
          </div>
          <div className="timer-digits mono">{formatClock(remaining)}</div>
        </div>
        <button
          type="button"
          className={`confirm-set-btn ${completed ? 'done' : ''}`}
          onClick={() => {
            triggerHaptic(10);
            setRunning(false);
            onToggleComplete();
          }}
        >
          <Check size={15} /> {completed ? 'Done' : 'Mark Done'}
        </button>
      </div>

      <div className="player-progress-track">
        <div className="player-progress-fill" style={{ width: `${completed ? 100 : pct}%` }} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className={`btn ${running ? 'btn-secondary' : 'btn-primary'}`}
          style={{ flex: 1, minHeight: 44 }}
          onClick={() => {
            triggerHaptic(10);
            if (remaining === 0) setRemaining(durationSec);
            setRunning((r) => !r);
          }}
        >
          {running ? (
            <>
              <Pause size={16} /> Pause
            </>
          ) : (
            <>
              <Play size={16} fill="currentColor" /> {remaining < durationSec && remaining > 0 ? 'Resume' : 'Start Timer'}
            </>
          )}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ minHeight: 44, padding: '0 14px' }}
          onClick={() => {
            setRunning(false);
            setRemaining(durationSec);
          }}
          aria-label="Reset timer"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
};

interface WorkoutPlayerProps {
  session: WorkoutSession;
  equipment: Equipment[];
  exercises: Exercise[];
  recentSessions: WorkoutSession[];
  progress: Record<string, ExerciseProgress>;
  onUpdateSession: (updated: WorkoutSession) => void;
  onSwapExercise: (blockType: BlockType, instanceId: string, newExercise: Exercise) => void;
  onFinishWorkout: (completedSession: WorkoutSession) => void;
  onExit: () => void;
}

interface FlatStep {
  blockType: BlockType;
  blockTitle: string;
  planned: PlannedExercise;
}

export const WorkoutPlayer: React.FC<WorkoutPlayerProps> = ({
  session,
  equipment,
  exercises,
  recentSessions,
  progress,
  onUpdateSession,
  onSwapExercise,
  onFinishWorkout,
  onExit,
}) => {
  useWakeLock(true);

  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const equipmentMap = useMemo(() => new Map(equipment.map((e) => [e.id, e])), [equipment]);

  const steps: FlatStep[] = useMemo(() => {
    const list: FlatStep[] = [];
    for (const block of session.blocks) {
      for (const pe of block.exercises) {
        list.push({
          blockType: block.type,
          blockTitle: block.title,
          planned: pe,
        });
      }
    }
    return list;
  }, [session]);

  const [stepIdx, setStepIdx] = useState(0);
  const [isCompletedView, setIsCompletedView] = useState(false);
  const [showExitSheet, setShowExitSheet] = useState(false);
  const [showSwapSheet, setShowSwapSheet] = useState(false);
  const [restSeconds, setRestSeconds] = useState<number>(0);

  // Rest countdown ticker
  useEffect(() => {
    if (restSeconds <= 0) return;
    const t = window.setInterval(() => {
      setRestSeconds((s) => {
        if (s <= 1) {
          triggerHaptic([15, 50, 15]);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [restSeconds]);

  const currentStep = steps[stepIdx];
  const currentExercise = currentStep ? exerciseMap.get(currentStep.planned.exerciseId) : undefined;
  const currentEquipment = currentExercise ? equipmentMap.get(currentExercise.equipmentId) : undefined;

  const progressPct = steps.length > 0 ? Math.round(((stepIdx + 1) / steps.length) * 100) : 0;

  const goToStep = (nextIdx: number) => {
    setRestSeconds(0);
    setStepIdx(nextIdx);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updatePlannedExercise = (updater: (pe: PlannedExercise) => PlannedExercise) => {
    if (!currentStep) return;
    const updated: WorkoutSession = {
      ...session,
      blocks: session.blocks.map((b) =>
        b.type !== currentStep.blockType
          ? b
          : {
              ...b,
              exercises: b.exercises.map((pe) =>
                pe.instanceId === currentStep.planned.instanceId ? updater(pe) : pe
              ),
            }
      ),
    };
    onUpdateSession(updated);
  };

  const stepWeight = (setNumber: number, delta: -1 | 1) => {
    const weights = currentEquipment ? [...currentEquipment.weightOptions].sort((a, b) => a - b) : [];
    if (weights.length === 0) return;
    triggerHaptic(6);

    updatePlannedExercise((pe) => ({
      ...pe,
      sets: pe.sets.map((s) => {
        if (s.setNumber !== setNumber) return s;
        const idx = weights.indexOf(s.actualWeight);
        const curIdx = idx >= 0 ? idx : 0;
        const nextIdx = Math.min(weights.length - 1, Math.max(0, curIdx + delta));
        return { ...s, actualWeight: weights[nextIdx] };
      }),
    }));
  };

  const stepReps = (setNumber: number, delta: -1 | 1) => {
    triggerHaptic(6);
    updatePlannedExercise((pe) => ({
      ...pe,
      sets: pe.sets.map((s) =>
        s.setNumber !== setNumber
          ? s
          : { ...s, actualReps: Math.max(1, s.actualReps + delta) }
      ),
    }));
  };

  const toggleSetCompleted = (setNumber: number, forceComplete?: boolean) => {
    if (!currentStep || !currentExercise) return;
    const targetSet = currentStep.planned.sets.find((s) => s.setNumber === setNumber);
    const nextCompleted = forceComplete ?? !targetSet?.completed;
    triggerHaptic(12);

    updatePlannedExercise((pe) => ({
      ...pe,
      sets: pe.sets.map((s) =>
        s.setNumber !== setNumber ? s : { ...s, completed: nextCompleted }
      ),
    }));

    // Start a non-blocking 60s rest cue if more sets remain on a non-timed exercise
    if (
      nextCompleted &&
      !currentExercise.isTimed &&
      setNumber < currentStep.planned.sets.length
    ) {
      setRestSeconds(60);
    } else if (!nextCompleted) {
      setRestSeconds(0);
    }
  };

  const setEffort = (effort: EffortRating) => {
    triggerHaptic(14);
    setRestSeconds(0);
    updatePlannedExercise((pe) => ({
      ...pe,
      effort,
      sets: pe.sets.map((s) => ({ ...s, completed: true })),
    }));
  };

  const finalizeSession = () => {
    const completed: WorkoutSession = {
      ...session,
      completedAt: new Date().toISOString(),
    };
    onFinishWorkout(completed);
    setRestSeconds(0);
    setShowExitSheet(false);
    setIsCompletedView(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNext = () => {
    triggerHaptic(10);
    if (stepIdx < steps.length - 1) {
      goToStep(stepIdx + 1);
    } else {
      finalizeSession();
    }
  };

  if (isCompletedView) {
    const totalSets = steps.reduce(
      (sum, st) => sum + st.planned.sets.filter((s) => s.completed).length,
      0
    );

    const levelUps: { name: string; nextLabel: string }[] = [];
    for (const st of steps) {
      if (st.blockType !== 'strength') continue;
      const ex = exerciseMap.get(st.planned.exerciseId);
      if (!ex) continue;
      const hasWork = st.planned.effort || st.planned.sets.some((s) => s.completed);
      if (!hasWork) continue;
      const eq = equipmentMap.get(ex.equipmentId);
      const unit = eq?.weightUnit ?? 'lbs';
      const updatedEntry = computeUpdatedProgress(st.planned, st.planned.effort ?? 'just_right');
      const next = getNextTarget(ex, eq, progress[ex.id] ?? updatedEntry);
      if (next.weight > 0) {
        levelUps.push({ name: ex.name, nextLabel: `${next.weight} ${unit} × ${next.reps}` });
      }
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ textAlign: 'center', padding: '28px 18px' }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              background: 'var(--accent-emerald-soft)',
              color: 'var(--accent-emerald-bright)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <Trophy size={28} />
          </div>
          <h1 className="page-title">Workout Complete</h1>
          <p className="page-subtitle" style={{ marginBottom: 20 }}>
            You completed <span className="mono">{totalSets}</span> sets across{' '}
            <span className="mono">{steps.length}</span> movements.
          </p>
          <button type="button" className="btn btn-primary" onClick={onExit}>
            Done
          </button>
        </div>

        {levelUps.length > 0 && (
          <div className="card">
            <div className="card-header" style={{ marginBottom: 8 }}>
              <span className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={14} /> Next Time Targets
              </span>
            </div>
            {levelUps.map((item) => (
              <div key={item.name} className="exercise-row">
                <span className="exercise-name">{item.name}</span>
                <span className="badge badge-emerald mono">{item.nextLabel}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!currentStep || !currentExercise) {
    return null;
  }

  const hasWeights = (currentEquipment?.weightOptions.length ?? 0) > 0;
  const anyWorkLogged =
    Boolean(currentStep.planned.effort) || currentStep.planned.sets.some((s) => s.completed);
  const readyForNext =
    currentStep.planned.sets.every((s) => s.completed) && Boolean(currentStep.planned.effort);
  const isLastStep = stepIdx === steps.length - 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Top Player Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="btn-ghost" onClick={() => setShowExitSheet(true)}>
          <X size={16} /> Pause
        </button>
        <span className="section-label" style={{ textAlign: 'center' }}>
          {currentStep.blockTitle} · {stepIdx + 1}/{steps.length}
        </span>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setShowSwapSheet(true)}
          aria-label={`Swap ${currentExercise.name}`}
        >
          <ArrowLeftRight size={14} /> Swap
        </button>
      </div>

      <div className="player-progress-track">
        <div className="player-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Exercise Header + Form Visual + Safety Cues */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: 6 }}>
            <span className="badge badge-slate">{currentEquipment?.name}</span>
            {currentStep.planned.isFirstTime && currentStep.blockType === 'strength' && (
              <span className="badge badge-amber">
                <Sparkles size={11} /> First time — adjust to a comfortable weight
              </span>
            )}
          </div>
          <h1 className="page-title" style={{ marginTop: 2 }}>
            {currentExercise.name}
          </h1>
        </div>

        <FormVisual visualKey={currentExercise.visualKey} label={currentExercise.name} />

        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>
            Safety &amp; Form Cues
          </div>
          <ul className="cue-list">
            {currentExercise.safetyCues.map((cue, idx) => (
              <li key={idx}>{cue}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Set / Timer Logging */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="card-header" style={{ marginBottom: 0 }}>
          <span className="section-label">
            {currentExercise.isTimed ? 'Timer' : 'Sets'}
          </span>
          {!currentExercise.isTimed && (
            <span className="exercise-meta mono">
              Aim for {currentExercise.repRange[0]}–{currentExercise.repRange[1]} reps
            </span>
          )}
        </div>

        {currentExercise.isTimed ? (
          <TimedSetControl
            key={currentStep.planned.instanceId}
            durationSec={currentExercise.durationSec ?? 60}
            completed={currentStep.planned.sets[0]?.completed ?? false}
            onToggleComplete={(force) => toggleSetCompleted(1, force)}
          />
        ) : (
          currentStep.planned.sets.map((s) => (
            <div key={s.setNumber} className={`set-card ${s.completed ? 'completed' : ''}`}>
              <div className="set-card-top">
                <span className="mono" style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Set {s.setNumber} of {currentStep.planned.sets.length}
                </span>
                <button
                  type="button"
                  className={`confirm-set-btn ${s.completed ? 'done' : ''}`}
                  onClick={() => toggleSetCompleted(s.setNumber)}
                >
                  <Check size={15} /> {s.completed ? 'Logged' : 'Confirm Set'}
                </button>
              </div>

              <div className={`set-controls-grid ${hasWeights ? '' : 'single'}`}>
                {hasWeights && (
                  <div className="stepper-box">
                    <button
                      type="button"
                      className="stepper-btn"
                      onClick={() => stepWeight(s.setNumber, -1)}
                      aria-label={`Decrease Set ${s.setNumber} weight`}
                    >
                      −
                    </button>
                    <div className="stepper-value mono">
                      <span style={{ fontSize: '0.96rem', fontWeight: 700 }}>{s.actualWeight}</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {currentEquipment?.weightUnit ?? 'lbs'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="stepper-btn"
                      onClick={() => stepWeight(s.setNumber, 1)}
                      aria-label={`Increase Set ${s.setNumber} weight`}
                    >
                      +
                    </button>
                  </div>
                )}

                <div className="stepper-box">
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => stepReps(s.setNumber, -1)}
                    aria-label={`Decrease Set ${s.setNumber} reps`}
                  >
                    −
                  </button>
                  <div className="stepper-value mono">
                    <span style={{ fontSize: '0.96rem', fontWeight: 700 }}>{s.actualReps}</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>reps</span>
                  </div>
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => stepReps(s.setNumber, 1)}
                    aria-label={`Increase Set ${s.setNumber} reps`}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Non-blocking Rest Timer Pill */}
        {restSeconds > 0 && (
          <div className="rest-pill" role="status" aria-live="polite">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Timer size={16} color="var(--accent-emerald-bright)" />
              <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>
                Rest <span className="mono">{formatClock(restSeconds)}</span>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setRestSeconds((s) => s + 15)}
              >
                +15s
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setRestSeconds(0)}
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Effort Rating */}
        <div style={{ marginTop: 2 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>
            How did it feel? <span style={{ fontWeight: 500, textTransform: 'none', color: 'var(--text-muted)' }}>(auto-confirms sets)</span>
          </div>
          <div className="effort-grid">
            {(
              [
                { id: 'easy', label: 'Easy' },
                { id: 'just_right', label: 'Just Right' },
                { id: 'too_hard', label: 'Too Hard' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`effort-btn ${
                  currentStep.planned.effort === opt.id ? `selected-${opt.id}` : ''
                }`}
                onClick={() => setEffort(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Intentional Navigation Footer */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={stepIdx === 0}
          onClick={() => goToStep(Math.max(0, stepIdx - 1))}
          style={{ opacity: stepIdx === 0 ? 0.4 : 1 }}
        >
          <ChevronLeft size={18} /> Prev
        </button>

        <button
          type="button"
          className={`btn ${readyForNext || anyWorkLogged || isLastStep ? 'btn-primary' : 'btn-secondary'}`}
          onClick={handleNext}
          style={{ flex: 1 }}
        >
          {isLastStep
            ? 'Finish Workout'
            : readyForNext || anyWorkLogged
            ? 'Next Movement'
            : 'Skip Movement'}
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Mid-Workout Swap Sheet */}
      {showSwapSheet && (
        <SwapModal
          target={{
            blockType: currentStep.blockType,
            planned: currentStep.planned,
            exercise: currentExercise,
          }}
          session={session}
          equipment={equipment}
          exercises={exercises}
          recentSessions={recentSessions}
          onSelect={onSwapExercise}
          onClose={() => setShowSwapSheet(false)}
        />
      )}

      {/* Calm Pause / End Session Sheet */}
      {showExitSheet && (
        <div className="modal-backdrop" onClick={() => setShowExitSheet(false)}>
          <div
            className="modal-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div className="sheet-handle" />
            <h2 style={{ margin: 0, fontSize: '1.12rem' }}>Pause Workout?</h2>
            <p className="page-subtitle">
              Every set you confirmed is saved on this device. You can resume right from{' '}
              <strong>Today</strong> whenever you&apos;re ready.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowExitSheet(false)}
            >
              Keep Going
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setShowExitSheet(false);
                onExit();
              }}
            >
              Pause &amp; Save for Later
            </button>
            <button
              type="button"
              className="btn-ghost"
              style={{ alignSelf: 'center', color: 'var(--accent-emerald-bright)' }}
              onClick={finalizeSession}
            >
              Finish &amp; Log Completed Sets Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
