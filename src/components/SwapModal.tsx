import React from 'react';
import { X } from 'lucide-react';
import { resolvePlane } from '../engine/balance';
import { getSwapCandidates } from '../engine/workoutGenerator';
import type {
  BlockType,
  Equipment,
  Exercise,
  PlannedExercise,
  WorkoutSession,
} from '../types/gym';

interface SwapModalProps {
  target: {
    blockType: BlockType;
    planned: PlannedExercise;
    exercise: Exercise;
  };
  session: WorkoutSession;
  equipment: Equipment[];
  exercises: Exercise[];
  recentSessions: WorkoutSession[];
  onSelect: (blockType: BlockType, instanceId: string, newExercise: Exercise) => void;
  onClose: () => void;
}

export const SwapModal: React.FC<SwapModalProps> = ({
  target,
  session,
  equipment,
  exercises,
  recentSessions,
  onSelect,
  onClose,
}) => {
  const equipmentMap = new Map(equipment.map((e) => [e.id, e]));
  const currentPlane = resolvePlane(target.exercise);

  const candidates = getSwapCandidates(
    target.exercise,
    target.blockType,
    session,
    equipment,
    exercises,
    recentSessions
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-handle" />
        <div className="card-header">
          <div>
            <span className="section-label">Machine Occupied?</span>
            <h2 style={{ margin: '4px 0 0 0', fontSize: '1.08rem' }}>
              Swap {target.exercise.name}
            </h2>
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={onClose}
            aria-label="Close swap modal"
          >
            <X size={18} />
          </button>
        </div>

        {candidates.length === 0 ? (
          <p className="page-subtitle" style={{ padding: '12px 0' }}>
            No other available movements match this slot right now. You can turn on more machines
            or link exercises in <strong>My Gym</strong>.
          </p>
        ) : (
          <div>
            {candidates.map((cand) => {
              const eq = equipmentMap.get(cand.equipmentId);
              const isSamePlane = currentPlane && resolvePlane(cand) === currentPlane;
              return (
                <div key={cand.id} className="exercise-row">
                  <div style={{ minWidth: 0 }}>
                    <div
                      className="exercise-name"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                    >
                      <span>{cand.name}</span>
                      {isSamePlane && <span className="badge badge-emerald">Best match</span>}
                    </div>
                    <div className="exercise-meta">{eq?.name}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ minHeight: 40, padding: '8px 14px', fontSize: '0.84rem' }}
                    onClick={() => {
                      onSelect(target.blockType, target.planned.instanceId, cand);
                      onClose();
                    }}
                  >
                    Select
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
