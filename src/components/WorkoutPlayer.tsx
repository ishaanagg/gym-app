import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Timer,
  TrendingUp,
  Trophy,
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
import { useBackGuard } from '../utils/backNavigation';
import { formatClock, triggerHaptic, useWakeLock } from '../utils/ux';
import { FormVisual } from './FormVisual';
import { SwapModal } from './SwapModal';

interface TimedStageProps {
  durationSec: number;
  completed: boolean;
  isLastStep: boolean;
  onCompleteAndAdvance: () => void;
  onMarkCompletedOnly: () => void;
}

const TimedStage: React.FC<TimedStageProps> = ({
  durationSec,
  completed,
  isLastStep,
  onCompleteAndAdvance,
  onMarkCompletedOnly,
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
          onMarkCompletedOnly();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [running, onMarkCompletedOnly]);

  const pct = durationSec > 0 ? Math.round(((durationSec - remaining) / durationSec) * 100) : 0;

  return (
    <div className="card player-action-card">
      <div className="timer-box">
        <div className="timer-digits mono">{formatClock(remaining)}</div>
        <div className="player-progress-track">
          <div className="player-progress-fill" style={{ width: `${completed ? 100 : pct}%` }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1, minHeight: 40, padding: '8px 12px', fontSize: '0.9rem' }}
            onClick={() => {
              triggerHaptic(10);
              if (remaining === 0) setRemaining(durationSec);
              setRunning((r) => !r);
            }}
          >
            {running ? (
              <>
                <Pause size={15} /> Pause Timer
              </>
            ) : (
              <>
                <Play size={15} fill="currentColor" />{' '}
                {remaining < durationSec && remaining > 0 ? 'Resume' : 'Start Timer'}
              </>
            )}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ minHeight: 40, padding: '0 13px' }}
            onClick={() => {
              setRunning(false);
              setRemaining(durationSec);
            }}
            aria-label="Reset timer"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          setRunning(false);
          onCompleteAndAdvance();
        }}
      >
        <Check size={18} />
        {isLastStep ? 'Complete & Finish Workout' : 'Done — Next Movement'}
      </button>
    </div>
  );
};

interface StrengthStageProps {
  planned: PlannedExercise;
  exercise: Exercise;
  equipment?: Equipment;
  restSeconds: number;
  onAddRest: () => void;
  onClearRest: () => void;
  onStepWeight: (setNumber: number, delta: -1 | 1) => void;
  onStepReps: (setNumber: number, delta: -1 | 1) => void;
  onCompleteSet: (setNumber: number) => void;
  onRateEffortAndAdvance: (effort: EffortRating) => void;
}

const StrengthStage: React.FC<StrengthStageProps> = ({
  planned,
  exercise,
  equipment,
  restSeconds,
  onAddRest,
  onClearRest,
  onStepWeight,
  onStepReps,
  onCompleteSet,
  onRateEffortAndAdvance,
}) => {
  const firstIncomplete = planned.sets.find((s) => !s.completed)?.setNumber ?? planned.sets.length;
  const [selectedSetNum, setSelectedSetNum] = useState<number>(firstIncomplete);

  const activeSet =
    planned.sets.find((s) => s.setNumber === selectedSetNum) ?? planned.sets[0];
  const allSetsDone = planned.sets.every((s) => s.completed);
  const hasWeights = (equipment?.weightOptions.length ?? 0) > 0;
  const unit = equipment?.weightUnit ?? 'lbs';

  const handleConfirmCurrentSet = () => {
    onCompleteSet(activeSet.setNumber);
    const nextIncomplete = planned.sets.find(
      (s) => s.setNumber > activeSet.setNumber && !s.completed
    );
    if (nextIncomplete) {
      setSelectedSetNum(nextIncomplete.setNumber);
    }
  };

  return (
    <div className="card player-action-card">
      {/* Always render Set Selector Strip so 1-set and multi-set stages share exact height */}
      <div className="set-pills" role="tablist" aria-label="Sets">
        {planned.sets.map((s) => {
          const isSelected = s.setNumber === activeSet.setNumber && !allSetsDone;
          return (
            <button
              key={s.setNumber}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`set-pill ${s.completed ? 'done' : ''} ${isSelected ? 'active' : ''}`}
              onClick={() => setSelectedSetNum(s.setNumber)}
            >
              {s.completed && <Check size={13} />}
              <span>Set {s.setNumber}</span>
            </button>
          );
        })}
      </div>

      {/* Single Active-Set Dials */}
      {!allSetsDone ? (
        <>
          <div className="stage-status-slot">
            {restSeconds > 0 ? (
              <div className="rest-pill-inline" role="status" aria-live="polite">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Timer size={14} color="var(--accent-emerald-bright)" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                    Rest <span className="mono">{formatClock(restSeconds)}</span>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" className="rest-pill-btn" onClick={onAddRest}>
                    +15s
                  </button>
                  <button type="button" className="rest-pill-btn" onClick={onClearRest}>
                    Dismiss
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span className="section-label">Set {activeSet.setNumber}</span>
                <span className="exercise-meta mono">
                  Target {exercise.repRange[0]}–{exercise.repRange[1]} reps
                </span>
              </>
            )}
          </div>

          <div className={`dial-grid ${hasWeights ? '' : 'single'}`}>
            {hasWeights && (
              <div className="dial-box">
                <button
                  type="button"
                  className="dial-btn"
                  onClick={() => onStepWeight(activeSet.setNumber, -1)}
                  aria-label="Decrease weight"
                >
                  −
                </button>
                <div className="dial-readout mono">
                  <span className="dial-number">{activeSet.actualWeight}</span>
                  <span className="dial-unit">{unit}</span>
                </div>
                <button
                  type="button"
                  className="dial-btn"
                  onClick={() => onStepWeight(activeSet.setNumber, 1)}
                  aria-label="Increase weight"
                >
                  +
                </button>
              </div>
            )}

            <div className="dial-box">
              <button
                type="button"
                className="dial-btn"
                onClick={() => onStepReps(activeSet.setNumber, -1)}
                aria-label="Decrease reps"
              >
                −
              </button>
              <div className="dial-readout mono">
                <span className="dial-number">{activeSet.actualReps}</span>
                <span className="dial-unit">reps</span>
              </div>
              <button
                type="button"
                className="dial-btn"
                onClick={() => onStepReps(activeSet.setNumber, 1)}
                aria-label="Increase reps"
              >
                +
              </button>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirmCurrentSet}
          >
            <Check size={18} />
            Complete Set {activeSet.setNumber}
          </button>
        </>
      ) : (
        /* Progressive Disclosure: Effort Rating occupies exact same stage box */
        <>
          <div className="effort-stage-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span className="section-label" style={{ color: 'var(--accent-emerald-bright)' }}>
                All {planned.sets.length} {planned.sets.length === 1 ? 'Set' : 'Sets'} Done · How did that feel?
              </span>
              <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {hasWeights
                  ? `${activeSet.actualWeight} ${unit} × ${activeSet.actualReps}`
                  : `${activeSet.actualReps} reps`}
              </span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Tunes your target for next session and advances automatically.
            </span>
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
                  planned.effort === opt.id ? `selected-${opt.id}` : ''
                }`}
                onClick={() => onRateEffortAndAdvance(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
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
  onDiscardSession: () => void;
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
  onDiscardSession,
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
  const advanceTimerRef = useRef<number | null>(null);
  const guideCardRef = useRef<HTMLDivElement | null>(null);

  useBackGuard(
    true,
    () => {
      if (isCompletedView) {
        onExit();
      } else {
        setShowExitSheet(true);
      }
    },
    { priority: 'screen' }
  );
  useBackGuard(showExitSheet, () => setShowExitSheet(false), { priority: 'modal' });

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    };
  }, []);

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
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    setRestSeconds(0);
    setStepIdx(nextIdx);
    if (guideCardRef.current) {
      guideCardRef.current.scrollTop = 0;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const applyExerciseUpdate = (updater: (pe: PlannedExercise) => PlannedExercise): WorkoutSession | null => {
    if (!currentStep) return null;
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
    return updated;
  };

  const stepWeight = (setNumber: number, delta: -1 | 1) => {
    const weights = currentEquipment ? [...currentEquipment.weightOptions].sort((a, b) => a - b) : [];
    if (weights.length === 0) return;
    triggerHaptic(6);

    applyExerciseUpdate((pe) => {
      const target = pe.sets.find((s) => s.setNumber === setNumber);
      if (!target) return pe;
      const idx = weights.indexOf(target.actualWeight);
      const curIdx = idx >= 0 ? idx : 0;
      const nextWeight = weights[Math.min(weights.length - 1, Math.max(0, curIdx + delta))];

      return {
        ...pe,
        sets: pe.sets.map((s) => {
          if (s.setNumber === setNumber) return { ...s, actualWeight: nextWeight };
          // Smart carry-forward: update subsequent uncompleted sets so user dials weight once
          if (s.setNumber > setNumber && !s.completed) {
            return { ...s, actualWeight: nextWeight };
          }
          return s;
        }),
      };
    });
  };

  const stepReps = (setNumber: number, delta: -1 | 1) => {
    triggerHaptic(6);
    applyExerciseUpdate((pe) => ({
      ...pe,
      sets: pe.sets.map((s) =>
        s.setNumber !== setNumber
          ? s
          : { ...s, actualReps: Math.max(1, s.actualReps + delta) }
      ),
    }));
  };

  const completeSingleSet = (setNumber: number) => {
    if (!currentStep || !currentExercise) return;
    triggerHaptic(12);
    applyExerciseUpdate((pe) => ({
      ...pe,
      sets: pe.sets.map((s) => (s.setNumber === setNumber ? { ...s, completed: true } : s)),
    }));

    const remainingIncomplete = currentStep.planned.sets.filter(
      (s) => s.setNumber !== setNumber && !s.completed
    ).length;
    if (remainingIncomplete > 0) {
      const defaultRest =
        session.intensity === 'light' ? 45 : session.intensity === 'hard' ? 75 : 60;
      setRestSeconds(defaultRest);
    } else {
      setRestSeconds(0);
    }
  };

  const finalizeWithSession = (baseSession: WorkoutSession) => {
    const completed: WorkoutSession = {
      ...baseSession,
      completedAt: new Date().toISOString(),
    };
    onFinishWorkout(completed);
    setRestSeconds(0);
    setShowExitSheet(false);
    setIsCompletedView(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const advanceOrFinish = (latestSession: WorkoutSession) => {
    if (stepIdx < steps.length - 1) {
      goToStep(stepIdx + 1);
    } else {
      finalizeWithSession(latestSession);
    }
  };

  const handleRateEffortAndAdvance = (effort: EffortRating) => {
    triggerHaptic(14);
    setRestSeconds(0);
    const updated = applyExerciseUpdate((pe) => ({
      ...pe,
      effort,
      sets: pe.sets.map((s) => ({ ...s, completed: true })),
    }));
    if (!updated) return;

    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = window.setTimeout(() => {
      advanceOrFinish(updated);
    }, 220);
  };

  const handleCompleteTimedAndAdvance = () => {
    triggerHaptic(12);
    const updated = applyExerciseUpdate((pe) => ({
      ...pe,
      sets: pe.sets.map((s) => ({ ...s, completed: true })),
    }));
    if (updated) advanceOrFinish(updated);
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
      <div className="player-completed">
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
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
          <h1 className="page-title">Session Complete</h1>
          <p className="page-subtitle" style={{ marginBottom: 22 }}>
            <span className="mono">{totalSets}</span> sets completed across{' '}
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
                <TrendingUp size={14} /> Next Session Targets
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

  // Only Strength & non-timed Core ask for Effort; Warm-up, Cardio, Stretch & Timed Planks complete in 1 tap.
  const isTimedFlow =
    Boolean(currentExercise.isTimed) ||
    currentStep.blockType === 'warmup' ||
    currentStep.blockType === 'cardio' ||
    currentStep.blockType === 'stretch';

  const isLastStep = stepIdx === steps.length - 1;

  return (
    <div className="player-shell">
      {/* Zone A: Pinned Chrome-Free Player Header */}
      <div className="player-top">
        <div className="player-header-row">
          <button type="button" className="btn-ghost" onClick={() => setShowExitSheet(true)}>
            Pause
          </button>
          <span className="section-label" style={{ textAlign: 'center' }}>
            {currentStep.blockTitle} · {stepIdx + 1}/{steps.length}
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowSwapSheet(true)}
            aria-label={`Swap ${currentExercise.name}`}
            title={`Swap ${currentExercise.name}`}
          >
            <ArrowLeftRight size={15} />
          </button>
        </div>

        <div className="player-progress-track">
          <div className="player-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Zone B: Flexible Movement Posture & Cues (absorbs title/badge/cue height changes) */}
      <div ref={guideCardRef} className="card player-guide-card">
        <div style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="badge badge-slate">{currentEquipment?.name}</span>
            {currentStep.planned.isFirstTime && currentStep.blockType === 'strength' && (
              <span className="badge badge-amber">Start comfortable — we&apos;ll tune from here</span>
            )}
          </div>
          <h1 className="player-title">{currentExercise.name}</h1>
        </div>

        <FormVisual visualKey={currentExercise.visualKey} label={currentExercise.name} />

        <ul className="cue-list" style={{ flexShrink: 0 }}>
          {currentExercise.safetyCues.map((cue, idx) => (
            <li key={idx}>{cue}</li>
          ))}
        </ul>
      </div>

      {/* Zone C: Spatial-Locked Action Stage + Step Navigation */}
      <div className="player-dock">
        {isTimedFlow ? (
          <TimedStage
            key={currentStep.planned.instanceId}
            durationSec={currentExercise.durationSec ?? 60}
            completed={currentStep.planned.sets[0]?.completed ?? false}
            isLastStep={isLastStep}
            onCompleteAndAdvance={handleCompleteTimedAndAdvance}
            onMarkCompletedOnly={() => {
              applyExerciseUpdate((pe) => ({
                ...pe,
                sets: pe.sets.map((s) => ({ ...s, completed: true })),
              }));
            }}
          />
        ) : (
          <StrengthStage
            key={currentStep.planned.instanceId}
            planned={currentStep.planned}
            exercise={currentExercise}
            equipment={currentEquipment}
            restSeconds={restSeconds}
            onAddRest={() => setRestSeconds((s) => s + 15)}
            onClearRest={() => setRestSeconds(0)}
            onStepWeight={stepWeight}
            onStepReps={stepReps}
            onCompleteSet={completeSingleSet}
            onRateEffortAndAdvance={handleRateEffortAndAdvance}
          />
        )}

        {/* Pinned Step Navigation — stays at exact Y coordinate across all exercises */}
        <div className="player-nav-bar">
          <button
            type="button"
            className="btn-ghost"
            disabled={stepIdx === 0}
            onClick={() => goToStep(Math.max(0, stepIdx - 1))}
            style={{ opacity: stepIdx === 0 ? 0.3 : 1 }}
          >
            <ChevronLeft size={16} /> Previous
          </button>

          <button
            type="button"
            className="btn-ghost"
            onClick={() => advanceOrFinish(session)}
          >
            {isLastStep ? 'Finish Now' : 'Skip'} <ChevronRight size={16} />
          </button>
        </div>
      </div>

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

      {showExitSheet && (
        <div className="modal-backdrop" onClick={() => setShowExitSheet(false)}>
          <div
            className="modal-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-sheet-title"
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <div className="sheet-handle" />
            <h2 id="pause-sheet-title" style={{ margin: 0, fontSize: '1.12rem' }}>
              Pause or Exit Session?
            </h2>
            <p className="page-subtitle" style={{ marginBottom: 2 }}>
              Pause to resume later from <strong>Today</strong>, save finished sets, or exit without saving.
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
              Pause for Later
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ color: 'var(--accent-emerald-bright)' }}
              onClick={() => finalizeWithSession(session)}
            >
              End &amp; Save Completed Sets
            </button>
            <div
              style={{
                borderTop: '1px solid var(--border-hairline)',
                marginTop: 2,
                paddingTop: 10,
              }}
            >
              <button
                type="button"
                className="btn-danger-ghost"
                onClick={() => {
                  if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
                  setRestSeconds(0);
                  setShowExitSheet(false);
                  onDiscardSession();
                }}
              >
                Exit Without Saving
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
