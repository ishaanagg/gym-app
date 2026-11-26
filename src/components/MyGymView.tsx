import React, { useState } from 'react';
import { Dumbbell, Edit3, Plus, Power, Trash2, X } from 'lucide-react';
import { DEFAULT_GYM_ID } from '../data/defaultInventory';
import type {
  BlockType,
  Equipment,
  EquipmentCategory,
  Exercise,
  MovementPattern,
  MovementPlane,
  VisualKey,
  WeightUnit,
} from '../types/gym';

interface MyGymViewProps {
  gymName: string;
  equipment: Equipment[];
  exercises: Exercise[];
  onSaveEquipment: (item: Equipment) => Promise<void>;
  onSaveExercise: (exercise: Exercise) => Promise<void>;
  onDeleteEquipment: (id: string) => Promise<void>;
}

const PATTERN_TO_VISUAL: Record<MovementPattern, VisualKey> = {
  upper_push: 'chest_press',
  upper_pull: 'lat_pulldown',
  lower_squat: 'squat',
  lower_hinge: 'hinge',
  core: 'core_plank',
  cardio: 'cardio_stride',
  mobility: 'mobility_flow',
  stretch: 'stretch_reach',
};

function derivePlane(
  pattern: MovementPattern,
  orientation: 'horizontal' | 'vertical'
): MovementPlane | undefined {
  if (pattern === 'upper_push') return orientation === 'vertical' ? 'vertical_push' : 'horizontal_push';
  if (pattern === 'upper_pull') return orientation === 'vertical' ? 'vertical_pull' : 'horizontal_pull';
  if (pattern === 'lower_squat') return 'squat';
  if (pattern === 'lower_hinge') return 'hinge';
  return undefined;
}

export const MyGymView: React.FC<MyGymViewProps> = ({
  gymName,
  equipment,
  exercises,
  onSaveEquipment,
  onSaveExercise,
  onDeleteEquipment,
}) => {
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [weightsInput, setWeightsInput] = useState('');
  const [addingExerciseFor, setAddingExerciseFor] = useState<Equipment | null>(null);
  const [exName, setExName] = useState('');
  const [exPattern, setExPattern] = useState<MovementPattern>('upper_push');
  const [exCue, setExCue] = useState('');
  const [exOrientation, setExOrientation] = useState<'horizontal' | 'vertical'>('horizontal');

  const openEditor = (item?: Equipment) => {
    const target: Equipment = item ?? {
      id: `eq-${Math.random().toString(36).slice(2, 8)}`,
      gymId: DEFAULT_GYM_ID,
      name: '',
      category: 'machine',
      weightUnit: 'lbs',
      weightOptions: [15, 30, 45, 60, 75, 90, 105, 120],
      isAvailable: true,
      notes: '',
    };
    setEditing(target);
    setConfirmDelete(false);
    setWeightsInput(target.weightOptions.join(', '));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name.trim()) return;

    const parsedWeights = weightsInput
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((n) => !Number.isNaN(n) && n > 0)
      .sort((a, b) => a - b);

    const uniqueWeights = Array.from(new Set(parsedWeights));

    await onSaveEquipment({
      ...editing,
      name: editing.name.trim(),
      weightOptions: uniqueWeights,
    });
    setEditing(null);
  };

  const handleSaveNewExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingExerciseFor || !exName.trim()) return;

    const block: BlockType =
      exPattern === 'core'
        ? 'core'
        : exPattern === 'cardio'
        ? 'cardio'
        : exPattern === 'mobility'
        ? 'warmup'
        : exPattern === 'stretch'
        ? 'stretch'
        : 'strength';

    const newExercise: Exercise = {
      id: `ex-${Math.random().toString(36).slice(2, 8)}`,
      name: exName.trim(),
      equipmentId: addingExerciseFor.id,
      block,
      pattern: exPattern,
      plane: derivePlane(exPattern, exOrientation),
      repRange: [8, 12],
      visualKey: PATTERN_TO_VISUAL[exPattern],
      safetyCues: [
        exCue.trim() || 'Move through a smooth, controlled range of motion.',
        'Keep your core braced and posture tall.',
      ],
    };

    await onSaveExercise(newExercise);
    setAddingExerciseFor(null);
    setExName('');
    setExCue('');
    setExOrientation('horizontal');
  };

  const toggleAvailable = async (item: Equipment) => {
    await onSaveEquipment({ ...item, isAvailable: !item.isAvailable });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="page-title">{gymName}</h1>
          <p className="page-subtitle">
            Customize machines, exact plate increments, and linked movements.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '10px 12px', fontSize: '0.84rem' }}
          onClick={() => openEditor()}
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {equipment.map((item) => {
        const linkedCount = exercises.filter((ex) => ex.equipmentId === item.id).length;

        return (
          <div
            key={item.id}
            className="card"
            style={{ opacity: item.isAvailable ? 1 : 0.55, transition: 'opacity 0.15s ease' }}
          >
            <div className="card-header" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Dumbbell size={16} color="var(--accent-emerald)" />
                <span style={{ fontWeight: 700, fontSize: '0.98rem' }}>{item.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => openEditor(item)}
                  aria-label={`Edit ${item.name}`}
                >
                  <Edit3 size={14} /> Edit
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => toggleAvailable(item)}
                  aria-label={`Toggle ${item.name}`}
                  style={{ color: item.isAvailable ? 'var(--accent-emerald)' : 'var(--text-muted)' }}
                >
                  <Power size={14} /> {item.isAvailable ? 'On' : 'Off'}
                </button>
              </div>
            </div>

            {item.notes && (
              <div className="exercise-meta" style={{ marginBottom: 8 }}>
                {item.notes}
              </div>
            )}

            {item.weightOptions.length > 0 ? (
              <div className="chip-list" style={{ marginBottom: 10 }}>
                {item.weightOptions.map((w) => (
                  <span key={w} className="weight-chip">
                    {w} {item.weightUnit}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ marginBottom: 10 }}>
                <span className="badge badge-slate">Bodyweight / Duration-based</span>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 8,
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <span className="exercise-meta">
                {linkedCount} {linkedCount === 1 ? 'exercise' : 'exercises'} linked
              </span>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setAddingExerciseFor(item)}
                style={{ color: 'var(--accent-emerald)' }}
              >
                <Plus size={14} /> Add Exercise
              </button>
            </div>
          </div>
        );
      })}

      {/* Equipment Editor Modal */}
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <form
            className="modal-sheet"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSave}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div className="sheet-handle" />
            <div className="card-header" style={{ marginBottom: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.08rem' }}>
                {editing.name ? `Edit ${editing.name}` : 'Add Equipment'}
              </h2>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setEditing(null)}
                aria-label="Close editor"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                Machine / Equipment Name
              </label>
              <input
                className="input-field"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="e.g., LifeFitness Chest Press"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
              <div>
                <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                  Category
                </label>
                <select
                  className="input-field"
                  value={editing.category}
                  onChange={(e) =>
                    setEditing({ ...editing, category: e.target.value as EquipmentCategory })
                  }
                >
                  <option value="machine">Pin-Loaded Machine</option>
                  <option value="free_weight">Free Weight</option>
                  <option value="cardio">Cardio Machine</option>
                  <option value="bodyweight">Mat / Bodyweight</option>
                </select>
              </div>
              <div>
                <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                  Unit
                </label>
                <select
                  className="input-field"
                  value={editing.weightUnit}
                  onChange={(e) =>
                    setEditing({ ...editing, weightUnit: e.target.value as WeightUnit })
                  }
                >
                  <option value="lbs">lbs</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>

            <div>
              <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                Exact Weight Plates ({editing.weightUnit}, comma-separated)
              </label>
              <input
                className="input-field mono"
                value={weightsInput}
                onChange={(e) => setWeightsInput(e.target.value)}
                placeholder="15, 30, 45, 60, 75, 90"
              />
              <div className="exercise-meta" style={{ marginTop: 4 }}>
                Leave empty for cardio or bodyweight equipment.
              </div>
            </div>

            <div>
              <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                Notes (optional)
              </label>
              <input
                className="input-field"
                value={editing.notes ?? ''}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                placeholder="e.g., Seat setting 4, pin-loaded"
              />
            </div>

            <button type="submit" className="btn btn-primary">
              Save Equipment
            </button>

            {equipment.some((e) => e.id === editing.id) &&
              (!confirmDelete ? (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ color: '#fda4af', alignSelf: 'center' }}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={14} /> Remove this machine
                </button>
              ) : (
                <div
                  style={{
                    background: 'var(--accent-rose-soft)',
                    borderRadius: 'var(--radius-md)',
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: '0.86rem' }}>
                    Remove <strong>{editing.name}</strong> from your gym? Past workouts and progress are kept.
                    Tip: use <strong>Off</strong> instead if it's just temporarily broken.
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{ flex: 1, background: 'var(--accent-rose)', color: '#fff' }}
                      onClick={async () => {
                        await onDeleteEquipment(editing.id);
                        setEditing(null);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
          </form>
        </div>
      )}

      {/* Add Exercise to Equipment Modal */}
      {addingExerciseFor && (
        <div className="modal-backdrop" onClick={() => setAddingExerciseFor(null)}>
          <form
            className="modal-sheet"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveNewExercise}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div className="sheet-handle" />
            <div className="card-header" style={{ marginBottom: 0 }}>
              <div>
                <span className="section-label">{addingExerciseFor.name}</span>
                <h2 style={{ margin: '4px 0 0 0', fontSize: '1.08rem' }}>Link New Exercise</h2>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setAddingExerciseFor(null)}
                aria-label="Close exercise modal"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                Exercise Name
              </label>
              <input
                className="input-field"
                value={exName}
                onChange={(e) => setExName(e.target.value)}
                placeholder="e.g., Seated Shoulder Press"
                required
              />
            </div>

            <div>
              <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                Movement Pattern
              </label>
              <select
                className="input-field"
                value={exPattern}
                onChange={(e) => setExPattern(e.target.value as MovementPattern)}
              >
                <option value="upper_push">Upper Push</option>
                <option value="upper_pull">Upper Pull</option>
                <option value="lower_squat">Lower Squat</option>
                <option value="lower_hinge">Lower Hinge</option>
                <option value="core">Abs &amp; Core</option>
              </select>
            </div>

            {(exPattern === 'upper_push' || exPattern === 'upper_pull') && (
              <div>
                <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                  Direction
                </label>
                <select
                  className="input-field"
                  value={exOrientation}
                  onChange={(e) => setExOrientation(e.target.value as 'horizontal' | 'vertical')}
                >
                  <option value="horizontal">
                    Horizontal ({exPattern === 'upper_push' ? 'chest press' : 'row'})
                  </option>
                  <option value="vertical">
                    Vertical ({exPattern === 'upper_push' ? 'overhead press' : 'pulldown'})
                  </option>
                </select>
              </div>
            )}

            <div>
              <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                Primary Safety Cue (optional)
              </label>
              <input
                className="input-field"
                value={exCue}
                onChange={(e) => setExCue(e.target.value)}
                placeholder="e.g., Keep lower back pressed into the pad"
              />
            </div>

            <button type="submit" className="btn btn-primary">
              Add Exercise to Machine
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
