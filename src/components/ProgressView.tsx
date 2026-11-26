import React, { useMemo } from 'react';
import { Calendar, Check, TrendingUp } from 'lucide-react';
import { getNextTarget } from '../engine/workoutGenerator';
import type { Equipment, Exercise, ExerciseProgress, WorkoutSession } from '../types/gym';

interface ProgressViewProps {
  sessions: WorkoutSession[];
  progress: Record<string, ExerciseProgress>;
  exercises: Exercise[];
  equipment: Equipment[];
}

function getLast7Days(completedSessions: WorkoutSession[]) {
  const activeDates = new Set(
    completedSessions.map((s) => new Date(s.completedAt ?? s.createdAt).toDateString())
  );
  const todayStr = new Date().toDateString();
  const days: { key: string; label: string; active: boolean; isToday: boolean }[] = [];

  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const dateKey = d.toDateString();
    const label = d.toLocaleDateString(undefined, { weekday: 'narrow' });
    days.push({
      key: dateKey,
      label,
      active: activeDates.has(dateKey),
      isToday: dateKey === todayStr,
    });
  }
  return days;
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  sessions,
  progress,
  exercises,
  equipment,
}) => {
  const completedSessions = useMemo(
    () => sessions.filter((s) => Boolean(s.completedAt)),
    [sessions]
  );
  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const equipmentMap = useMemo(() => new Map(equipment.map((e) => [e.id, e])), [equipment]);

  const totalMinutes = useMemo(
    () => completedSessions.reduce((sum, s) => sum + s.durationMin, 0),
    [completedSessions]
  );

  const weekDays = useMemo(() => getLast7Days(completedSessions), [completedSessions]);

  const trackedExercises = useMemo(
    () =>
      Object.values(progress)
        .filter((entry) => {
          const ex = exerciseMap.get(entry.exerciseId);
          return ex && (ex.block === 'strength' || ex.block === 'core') && !ex.isTimed;
        })
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [progress, exerciseMap]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 className="page-title">Momentum</h1>
        <p className="page-subtitle">
          Steady consistency and gradual strength built on your gym&apos;s exact plates.
        </p>
      </div>

      {/* 7-Day Rhythm + Human Stats */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="week-strip" aria-label="Last 7 days">
          {weekDays.map((d) => (
            <div key={d.key} className="week-day">
              <span className="week-day-label">{d.label}</span>
              <div className={`week-dot ${d.active ? 'active' : ''} ${d.isToday ? 'today' : ''}`}>
                {d.active ? <Check size={13} strokeWidth={3} /> : '·'}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            paddingTop: 14,
            borderTop: '1px solid var(--border-hairline)',
          }}
        >
          <div>
            <div className="section-label">Sessions</div>
            <div className="mono" style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 2 }}>
              {completedSessions.length}
            </div>
          </div>
          <div>
            <div className="section-label">Minutes Moved</div>
            <div
              className="mono"
              style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                marginTop: 2,
                color: 'var(--accent-emerald-bright)',
              }}
            >
              {totalMinutes}
            </div>
          </div>
        </div>
      </div>

      {/* Strength Trajectory */}
      <div className="card">
        <div className="card-header">
          <span className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={14} /> Strength Progression
          </span>
        </div>

        {trackedExercises.length === 0 ? (
          <p className="page-subtitle">
            Finish your first workout to establish baselines and next-session targets.
          </p>
        ) : (
          <div>
            {trackedExercises.map((entry) => {
              const ex = exerciseMap.get(entry.exerciseId);
              if (!ex) return null;
              const eq = equipmentMap.get(ex.equipmentId);
              const unit = eq?.weightUnit ?? 'lbs';
              const next = getNextTarget(ex, eq, entry);
              const leveledUp = next.weight > entry.currentWeight && entry.currentWeight > 0;

              return (
                <div key={entry.exerciseId} className="exercise-row">
                  <div>
                    <div className="exercise-name">{ex.name}</div>
                    <div className="exercise-meta mono">
                      {entry.currentWeight > 0
                        ? `${entry.currentWeight} ${unit} × ${entry.lastReps}`
                        : `${entry.lastReps} reps`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-emerald mono">
                      {leveledUp
                        ? `${entry.currentWeight} → ${next.weight} ${unit}`
                        : next.weight > 0
                        ? `Next ${next.weight} ${unit} × ${next.reps}`
                        : `Next ${next.reps} reps`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Sessions */}
      {completedSessions.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} /> Recent History
            </span>
          </div>

          <div>
            {completedSessions.slice(0, 8).map((s) => {
              const dateStr = new Date(s.completedAt ?? s.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              });
              const setsDone = s.blocks.reduce(
                (sum, b) =>
                  sum +
                  b.exercises.reduce(
                    (eSum, pe) => eSum + pe.sets.filter((st) => st.completed).length,
                    0
                  ),
                0
              );
              return (
                <div key={s.id} className="exercise-row">
                  <div>
                    <div className="exercise-name">
                      {dateStr} · {s.durationMin} min
                    </div>
                    <div className="exercise-meta">{setsDone} sets completed</div>
                  </div>
                  <span className="badge badge-slate mono">{s.durationMin}m</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
