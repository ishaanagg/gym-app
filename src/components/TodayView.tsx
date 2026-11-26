import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Play, RefreshCw, RotateCcw, Sparkles } from 'lucide-react';
import type {
  BlockType,
  Equipment,
  Exercise,
  PlannedExercise,
  SessionDuration,
  WorkoutSession,
} from '../types/gym';
import { describeSessionFocus, triggerHaptic } from '../utils/ux';
import { SwapModal } from './SwapModal';

interface TodayViewProps {
  duration: SessionDuration;
  onChangeDuration: (d: SessionDuration) => void;
  session: WorkoutSession;
  inProgressSession: WorkoutSession | null;
  recentSessions: WorkoutSession[];
  equipment: Equipment[];
  exercises: Exercise[];
  onRegenerate: () => void;
  onSwapExercise: (blockType: BlockType, instanceId: string, newExercise: Exercise) => void;
  onStartWorkout: () => void;
  onResumeWorkout: () => void;
  onDiscardInProgress: () => void;
  userName?: string;
}

const DURATIONS: SessionDuration[] = [20, 30, 45, 60];

export const TodayView: React.FC<TodayViewProps> = ({
  duration,
  onChangeDuration,
  session,
  inProgressSession,
  recentSessions,
  equipment,
  exercises,
  onRegenerate,
  onSwapExercise,
  onStartWorkout,
  onResumeWorkout,
  onDiscardInProgress,
  userName,
}) => {
  const [swapTarget, setSwapTarget] = useState<{
    blockType: BlockType;
    planned: PlannedExercise;
    exercise: Exercise;
  } | null>(null);

  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const equipmentMap = useMemo(() => new Map(equipment.map((e) => [e.id, e])), [equipment]);

  const focusSummary = useMemo(
    () => describeSessionFocus(session, exercises, recentSessions),
    [session, exercises, recentSessions]
  );

  const totalMovements = session.blocks.reduce((sum, b) => sum + b.exercises.length, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 className="page-title">
          {userName ? `Hi ${userName}, ready to move?` : 'Today\u2019s Session'}
        </h1>
        <p className="page-subtitle">{focusSummary}</p>
      </div>

      {/* Resume In-Progress Workout Banner */}
      {inProgressSession && (
        <div
          className="card"
          style={{
            borderColor: 'rgba(245, 158, 11, 0.4)',
            background:
              'linear-gradient(180deg, rgba(245, 158, 11, 0.11) 0%, rgba(17, 23, 32, 0.96) 100%)',
          }}
        >
          <div className="card-header" style={{ marginBottom: 8 }}>
            <span className="badge badge-amber">Paused Session</span>
            <button type="button" className="btn-ghost" onClick={onDiscardInProgress}>
              Discard
            </button>
          </div>
          <p className="page-subtitle" style={{ marginBottom: 12 }}>
            Pick up your {inProgressSession.durationMin}-minute workout right where you left off.
          </p>
          <button type="button" className="btn btn-primary" onClick={onResumeWorkout}>
            <RotateCcw size={17} /> Resume Workout
          </button>
        </div>
      )}

      {/* Integrated Hero Card: Segmented Duration + Shuffle + Primary Start CTA */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="card-header" style={{ marginBottom: 0 }}>
          <div>
            <span className="section-label">Session Length</span>
            <div className="exercise-meta" style={{ marginTop: 2 }}>
              {totalMovements} movements across {session.blocks.length} blocks
            </div>
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              triggerHaptic(8);
              onRegenerate();
            }}
            title="Shuffle exercises"
          >
            <RefreshCw size={14} /> Shuffle
          </button>
        </div>

        <div className="segmented-control" role="radiogroup" aria-label="Workout duration">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={duration === d}
              className={`segment-btn ${duration === d ? 'active' : ''}`}
              onClick={() => {
                triggerHaptic(8);
                onChangeDuration(d);
              }}
            >
              <span className="mono">{d}</span>
              <span className="unit">m</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            triggerHaptic(12);
            onStartWorkout();
          }}
        >
          <Play size={18} fill="currentColor" />
          Start {duration}-Min Workout
        </button>
      </div>

      {/* 5-Block Plan Overview */}
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
                          ? `${Math.round(
                              (ex.durationSec ?? 60) >= 60
                                ? (ex.durationSec ?? 60) / 60
                                : ex.durationSec ?? 45
                            )}${(ex.durationSec ?? 60) >= 60 ? ' min' : 's'}`
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

      {swapTarget && (
        <SwapModal
          target={swapTarget}
          session={session}
          equipment={equipment}
          exercises={exercises}
          recentSessions={recentSessions}
          onSelect={onSwapExercise}
          onClose={() => setSwapTarget(null)}
        />
      )}
    </div>
  );
};
