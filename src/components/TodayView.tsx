import React, { useState } from 'react';
import { ArrowLeftRight, Play, RefreshCw, RotateCcw, Sparkles, X } from 'lucide-react';
import { getSwapCandidates } from '../engine/workoutGenerator';
import type {
  BlockType,
  Equipment,
  Exercise,
  PlannedExercise,
  SessionDuration,
  WorkoutSession,
} from '../types/gym';

interface TodayViewProps {
  duration: SessionDuration;
  onChangeDuration: (d: SessionDuration) => void;
  session: WorkoutSession;
  inProgressSession: WorkoutSession | null;
  equipment: Equipment[];
  exercises: Exercise[];
  onRegenerate: () => void;
  onSwapExercise: (blockType: BlockType, instanceId: string, newExercise: Exercise) => void;
  onStartWorkout: () => void;
  onResumeWorkout: () => void;
  onDiscardInProgress: () => void;
}

const DURATIONS: SessionDuration[] = [20, 30, 45, 60];

export const TodayView: React.FC<TodayViewProps> = ({
  duration,
  onChangeDuration,
  session,
  inProgressSession,
  equipment,
  exercises,
  onRegenerate,
  onSwapExercise,
  onStartWorkout,
  onResumeWorkout,
  onDiscardInProgress,
}) => {
  const [swapTarget, setSwapTarget] = useState<{
    blockType: BlockType;
    planned: PlannedExercise;
    exercise: Exercise;
  } | null>(null);

  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const equipmentMap = new Map(equipment.map((e) => [e.id, e]));

  const swapCandidates = swapTarget
    ? getSwapCandidates(
        swapTarget.exercise,
        swapTarget.blockType,
        session,
        equipment,
        exercises
      )
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 className="page-title">Today&apos;s Session</h1>
        <p className="page-subtitle">
          Balanced rotation tailored to your building&apos;s gym.
        </p>
      </div>

      {/* Resume In-Progress Workout Banner */}
      {inProgressSession && (
        <div
          className="card"
          style={{
            borderColor: 'rgba(245, 158, 11, 0.45)',
            background:
              'linear-gradient(180deg, rgba(245, 158, 11, 0.1) 0%, rgba(18, 24, 33, 0.96) 100%)',
          }}
        >
          <div className="card-header" style={{ marginBottom: 8 }}>
            <span className="badge badge-amber">In-Progress Session Saved</span>
            <button type="button" className="btn-ghost" onClick={onDiscardInProgress}>
              Discard
            </button>
          </div>
          <p className="page-subtitle" style={{ marginBottom: 12 }}>
            You have an unfinished {inProgressSession.durationMin}-minute workout with saved sets.
          </p>
          <button type="button" className="btn btn-primary" onClick={onResumeWorkout}>
            <RotateCcw size={16} /> Resume Saved Workout
          </button>
        </div>
      )}

      {/* Session Length Picker */}
      <div className="card">
        <div className="card-header">
          <span className="section-label">Session Length</span>
          <button
            type="button"
            className="btn-ghost"
            onClick={onRegenerate}
            title="Shuffle exercises"
          >
            <RefreshCw size={14} /> Regenerate
          </button>
        </div>
        <div className="duration-grid">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={`duration-btn ${duration === d ? 'active' : ''}`}
              onClick={() => onChangeDuration(d)}
            >
              <span className="mono">{d}</span>
              <span className="unit">min</span>
            </button>
          ))}
        </div>
      </div>

      {/* Start CTA */}
      <button type="button" className="btn btn-primary" onClick={onStartWorkout}>
        <Play size={18} fill="currentColor" />
        Start {duration}-Min Workout
      </button>

      {/* 5-Block Preview */}
      {session.blocks.map((block) => (
        <div key={block.type} className="card">
          <div className="card-header">
            <span className="section-label">{block.title}</span>
            <span className="badge badge-slate mono">~{block.estimatedMinutes}m</span>
          </div>

          <div>
            {block.exercises.map((pe) => {
              const ex = exerciseMap.get(pe.exerciseId);
              if (!ex) return null;
              const eq = equipmentMap.get(ex.equipmentId);
              const unit = eq?.weightUnit ?? 'lbs';
              const firstSet = pe.sets[0];

              return (
                <div key={pe.instanceId} className="exercise-row">
                  <div style={{ minWidth: 0 }}>
                    <div
                      className="exercise-name"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}
                    >
                      <span>{ex.name}</span>
                      {pe.isFirstTime && block.type === 'strength' && (
                        <span className="badge badge-amber">
                          <Sparkles size={11} /> First time
                        </span>
                      )}
                    </div>
                    <div className="exercise-meta">
                      {eq?.name} ·{' '}
                      <span className="mono">
                        {ex.isTimed
                          ? `${Math.round((ex.durationSec ?? 60) >= 60 ? (ex.durationSec ?? 60) / 60 : ex.durationSec ?? 45)}${(ex.durationSec ?? 60) >= 60 ? ' min' : 's'}`
                          : firstSet.targetWeight > 0
                          ? `${pe.sets.length} × ${firstSet.targetReps} @ ${firstSet.targetWeight} ${unit}`
                          : `${pe.sets.length} × ${firstSet.targetReps} reps`}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() =>
                      setSwapTarget({ blockType: block.type, planned: pe, exercise: ex })
                    }
                    aria-label={`Swap ${ex.name}`}
                  >
                    <ArrowLeftRight size={14} /> Swap
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Swap Modal */}
      {swapTarget && (
        <div className="modal-backdrop" onClick={() => setSwapTarget(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <div>
                <span className="section-label">Machine Occupied?</span>
                <h2 style={{ margin: '4px 0 0 0', fontSize: '1.05rem' }}>
                  Swap {swapTarget.exercise.name}
                </h2>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setSwapTarget(null)}
                aria-label="Close swap modal"
              >
                <X size={18} />
              </button>
            </div>

            {swapCandidates.length === 0 ? (
              <p className="page-subtitle" style={{ padding: '12px 0' }}>
                No other available exercises for this pattern right now. You can enable more
                equipment or link exercises in <strong>My Gym</strong>.
              </p>
            ) : (
              <div>
                {swapCandidates.map((cand) => {
                  const eq = equipmentMap.get(cand.equipmentId);
                  return (
                    <div key={cand.id} className="exercise-row">
                      <div>
                        <div className="exercise-name">{cand.name}</div>
                        <div className="exercise-meta">{eq?.name}</div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '8px 12px', fontSize: '0.82rem' }}
                        onClick={() => {
                          onSwapExercise(swapTarget.blockType, swapTarget.planned.instanceId, cand);
                          setSwapTarget(null);
                        }}
                      >
                        Use This
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
