import React, { useRef, useState } from 'react';
import { Calendar, Download, TrendingUp, Upload } from 'lucide-react';
import { storageRepo } from '../db/storage';
import { getNextTarget } from '../engine/workoutGenerator';
import type { Equipment, Exercise, ExerciseProgress, WorkoutSession } from '../types/gym';

interface ProgressViewProps {
  sessions: WorkoutSession[];
  progress: Record<string, ExerciseProgress>;
  exercises: Exercise[];
  equipment: Equipment[];
  onDataImported: () => Promise<void>;
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  sessions,
  progress,
  exercises,
  equipment,
  onDataImported,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const completedSessions = sessions.filter((s) => Boolean(s.completedAt));
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const equipmentMap = new Map(equipment.map((e) => [e.id, e]));

  const trackedExercises = Object.values(progress).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const handleExport = async () => {
    const data = await storageRepo.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gym-copilot-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg('Backup exported.');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await storageRepo.importAll(parsed);
      await onDataImported();
      setStatusMsg('Backup restored successfully.');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Failed to import backup.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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

      {/* Local Backup */}
      <div className="card">
        <div className="card-header">
          <span className="section-label">Local Data Backup (JSON)</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={handleExport}>
            <Download size={16} /> Export
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} /> Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </div>
        {statusMsg && (
          <p className="exercise-meta" style={{ marginTop: 10, color: 'var(--accent-emerald)' }}>
            {statusMsg}
          </p>
        )}
      </div>
    </div>
  );
};
