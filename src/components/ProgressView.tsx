import React from 'react';
import { Calendar, TrendingUp } from 'lucide-react';
import { getNextTarget } from '../engine/workoutGenerator';
import type { Equipment, Exercise, ExerciseProgress, WorkoutSession } from '../types/gym';

interface ProgressViewProps {
  sessions: WorkoutSession[];
  progress: Record<string, ExerciseProgress>;
  exercises: Exercise[];
  equipment: Equipment[];
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  sessions,
  progress,
  exercises,
  equipment,
}) => {

  const completedSessions = sessions.filter((s) => Boolean(s.completedAt));
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const equipmentMap = new Map(equipment.map((e) => [e.id, e]));

  const trackedExercises = Object.values(progress).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 className="page-title">Progress &amp; History</h1>
        <p className="page-subtitle">
          Safe double progression mapped to your gym&apos;s exact weights.
        </p>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div className="card">
          <div className="section-label">Completed</div>
          <div className="mono" style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: 4 }}>
            {completedSessions.length}
          </div>
          <div className="exercise-meta">Total sessions</div>
        </div>
        <div className="card">
          <div className="section-label">Tracked Lifts</div>
          <div
            className="mono"
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              marginTop: 4,
              color: 'var(--accent-emerald)',
            }}
          >
            {trackedExercises.length}
          </div>
          <div className="exercise-meta">Active progressions</div>
        </div>
      </div>

      {/* Per-Exercise Progression */}
      <div className="card">
        <div className="card-header">
          <span className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={14} /> Exercise Progression
          </span>
        </div>

        {trackedExercises.length === 0 ? (
          <p className="page-subtitle">
            Complete your first workout to start tracking weights and next-session targets.
          </p>
        ) : (
          <div>
            {trackedExercises.map((entry) => {
              const ex = exerciseMap.get(entry.exerciseId);
              if (!ex) return null;
              const eq = equipmentMap.get(ex.equipmentId);
              const unit = eq?.weightUnit ?? 'lbs';
              const next = getNextTarget(ex, eq, entry);
              return (
                <div key={entry.exerciseId} className="exercise-row">
                  <div>
                    <div className="exercise-name">{ex.name}</div>
                    <div className="exercise-meta">
                      Last:{' '}
                      <span className="mono">
                        {entry.currentWeight > 0
                          ? `${entry.currentWeight} ${unit} × ${entry.lastReps}`
                          : `${entry.lastReps} reps`}
                      </span>{' '}
                      ({entry.lastEffort.replace('_', ' ')})
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-emerald mono">
                      Next:{' '}
                      {next.weight > 0 ? `${next.weight} ${unit} × ${next.reps}` : `${next.reps} reps`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Sessions */}
      <div className="card">
        <div className="card-header">
          <span className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={14} /> Recent Sessions
          </span>
        </div>

        {completedSessions.length === 0 ? (
          <p className="page-subtitle">No completed sessions yet.</p>
        ) : (
          <div>
            {completedSessions.slice(0, 8).map((s) => {
              const dateStr = new Date(s.completedAt ?? s.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              });
              const strengthBlock = s.blocks.find((b) => b.type === 'strength');
              const count = s.blocks.reduce((sum, b) => sum + b.exercises.length, 0);
              return (
                <div key={s.id} className="exercise-row">
                  <div>
                    <div className="exercise-name">
                      {dateStr} · {s.durationMin}-Min Session
                    </div>
                    <div className="exercise-meta">
                      {count} movements · {strengthBlock?.exercises.length ?? 0} strength
                    </div>
                  </div>
                  <span className="badge badge-slate mono">{s.durationMin}m</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
