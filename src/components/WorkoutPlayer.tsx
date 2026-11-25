import React, { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Sparkles, Trophy, X } from 'lucide-react';
import type {
  BlockType,
  EffortRating,
  Equipment,
  Exercise,
  PlannedExercise,
  WorkoutSession,
} from '../types/gym';
import { FormVisual } from './FormVisual';

interface WorkoutPlayerProps {
  session: WorkoutSession;
  equipment: Equipment[];
  exercises: Exercise[];
  onUpdateSession: (updated: WorkoutSession) => void;
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
  onUpdateSession,
  onFinishWorkout,
  onExit,
}) => {
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

  const currentStep = steps[stepIdx];
  const currentExercise = currentStep ? exerciseMap.get(currentStep.planned.exerciseId) : undefined;
  const currentEquipment = currentExercise ? equipmentMap.get(currentExercise.equipmentId) : undefined;

  const progressPct = steps.length > 0 ? Math.round(((stepIdx + 1) / steps.length) * 100) : 0;

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
    updatePlannedExercise((pe) => ({
      ...pe,
      sets: pe.sets.map((s) =>
        s.setNumber !== setNumber
          ? s
          : { ...s, actualReps: Math.max(1, s.actualReps + delta) }
      ),
    }));
  };

  const toggleSetCompleted = (setNumber: number) => {
    updatePlannedExercise((pe) => ({
      ...pe,
      sets: pe.sets.map((s) =>
        s.setNumber !== setNumber ? s : { ...s, completed: !s.completed }
      ),
    }));
  };

  const setEffort = (effort: EffortRating) => {
    updatePlannedExercise((pe) => ({
      ...pe,
      effort,
      // Auto-confirm any unconfirmed sets when user rates effort
      sets: pe.sets.map((s) => ({ ...s, completed: true })),
    }));
  };

  const handleNext = () => {
    if (stepIdx < steps.length - 1) {
      setStepIdx((i) => i + 1);
    } else {
      const completed: WorkoutSession = {
        ...session,
        completedAt: new Date().toISOString(),
      };
      onFinishWorkout(completed);
      setIsCompletedView(true);
    }
  };

  if (isCompletedView) {
    const totalSets = steps.reduce(
      (sum, st) => sum + st.planned.sets.filter((s) => s.completed).length,
      0
    );

    return (
      <div className="card" style={{ textAlign: 'center', padding: '28px 18px' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--accent-emerald-soft)',
            color: 'var(--accent-emerald)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}
        >
          <Trophy size={28} />
        </div>
        <h1 className="page-title">Session Complete!</h1>
        <p className="page-subtitle" style={{ marginBottom: 18 }}>
          You logged <span className="mono">{totalSets}</span> sets across{' '}
          <span className="mono">{steps.length}</span> movements. Next session&apos;s weights
          and rotation are already updated.
        </p>
        <button type="button" className="btn btn-primary" onClick={onExit}>
          Back to Home
        </button>
      </div>
    );
  }

  if (!currentStep || !currentExercise) {
    return null;
  }

  const hasWeights = (currentEquipment?.weightOptions.length ?? 0) > 0;
  const allSetsDone = currentStep.planned.sets.every((s) => s.completed);
  const canAdvance = allSetsDone && Boolean(currentStep.planned.effort);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Top Player Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <button type="button" className="btn-ghost" onClick={onExit}>
          <X size={16} /> End
        </button>
        <span className="section-label">
          {currentStep.blockTitle} · {stepIdx + 1}/{steps.length}
        </span>
        <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)' }}>
          {progressPct}%
        </span>
      </div>

      <div className="player-progress-track">
        <div className="player-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Exercise Header + Form Visual + Safety Cues */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: 4 }}>
            <span className="badge badge-slate">{currentEquipment?.name}</span>
            {currentStep.planned.isFirstTime && currentStep.blockType === 'strength' && (
              <span className="badge badge-amber">
                <Sparkles size={11} /> First time — adjust to a comfortable weight
              </span>
            )}
          </div>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            {currentExercise.name}
          </h1>
        </div>

        <FormVisual visualKey={currentExercise.visualKey} label={currentExercise.name} />

        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>
            Key Form Cues
          </div>
          <ul className="cue-list">
            {currentExercise.safetyCues.map((cue, idx) => (
              <li key={idx}>{cue}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Quick Set Logging */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="card-header" style={{ marginBottom: 4 }}>
          <span className="section-label">
            {currentExercise.isTimed ? 'Duration / Completion' : 'Log Sets (1-Tap Confirm)'}
          </span>
          {!currentExercise.isTimed && (
            <span className="exercise-meta mono">
              Target: {currentExercise.repRange[0]}–{currentExercise.repRange[1]} reps
            </span>
          )}
        </div>

        {currentStep.planned.sets.map((s) => (
          <div key={s.setNumber} className={`set-row ${s.completed ? 'completed' : ''}`}>
            <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {currentExercise.isTimed ? 'Block' : `Set ${s.setNumber}`}
            </span>

            {currentExercise.isTimed ? (
              <div style={{ gridColumn: 'span 2', fontSize: '0.88rem' }} className="mono">
                {(currentExercise.durationSec ?? 60) >= 60
                  ? `${Math.round((currentExercise.durationSec ?? 60) / 60)} min`
                  : `${currentExercise.durationSec ?? 45} sec`}
              </div>
            ) : (
              <>
                {hasWeights ? (
                  <div className="stepper-box">
                    <button
                      type="button"
                      className="stepper-btn"
                      onClick={() => stepWeight(s.setNumber, -1)}
                      aria-label="Decrease weight"
                    >
                      −
                    </button>
                    <span className="mono" style={{ fontSize: '0.84rem', fontWeight: 700 }}>
                      {s.actualWeight}{' '}
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {currentEquipment?.weightUnit ?? 'lbs'}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="stepper-btn"
                      onClick={() => stepWeight(s.setNumber, 1)}
                      aria-label="Increase weight"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <span className="exercise-meta">Bodyweight</span>
                )}

                <div className="stepper-box">
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => stepReps(s.setNumber, -1)}
                    aria-label="Decrease reps"
                  >
                    −
                  </button>
                  <span className="mono" style={{ fontSize: '0.84rem', fontWeight: 700 }}>
                    {s.actualReps} <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>rep</span>
                  </span>
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => stepReps(s.setNumber, 1)}
                    aria-label="Increase reps"
                  >
                    +
                  </button>
                </div>
              </>
            )}

            <button
              type="button"
              className={`confirm-set-btn ${s.completed ? 'done' : ''}`}
              onClick={() => toggleSetCompleted(s.setNumber)}
            >
              <Check size={14} /> {s.completed ? 'Done' : 'Confirm'}
            </button>
          </div>
        ))}

        {/* Effort Rating */}
        <div style={{ marginTop: 6 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>
            How did it feel?
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

      {/* Navigation Footer */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={stepIdx === 0}
          onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
          style={{ opacity: stepIdx === 0 ? 0.45 : 1 }}
        >
          <ChevronLeft size={18} /> Prev
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleNext}
          style={{ flex: 1, opacity: canAdvance ? 1 : 0.72 }}
        >
          {stepIdx === steps.length - 1 ? 'Finish Workout' : 'Next Movement'}
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};
