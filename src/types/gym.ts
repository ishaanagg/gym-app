export type EquipmentCategory = 'machine' | 'free_weight' | 'cardio' | 'bodyweight';

export type WeightUnit = 'lbs' | 'kg';

export type MovementPattern =
  | 'upper_push'
  | 'upper_pull'
  | 'lower_squat'
  | 'lower_hinge'
  | 'core'
  | 'cardio'
  | 'mobility'
  | 'stretch';

/** Strength movement plane used to balance sessions against recent history. */
export type MovementPlane =
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'squat'
  | 'hinge';

/** Optional muscle tags reserved for V2/V3 (calibration, photo detection). Not used in V1 scoring. */
export type MuscleGroup =
  | 'chest'
  | 'shoulders'
  | 'triceps'
  | 'lats'
  | 'mid_back'
  | 'rear_delts'
  | 'biceps'
  | 'quads'
  | 'glutes'
  | 'hamstrings'
  | 'core';

export type BlockType = 'warmup' | 'strength' | 'core' | 'cardio' | 'stretch';

export type SessionDuration = 20 | 30 | 45 | 60;

export type EffortRating = 'easy' | 'just_right' | 'too_hard';

export type SessionStatus = 'planned' | 'in_progress' | 'completed';

export type VisualKey =
  | 'chest_press'
  | 'overhead_press'
  | 'lat_pulldown'
  | 'seated_row'
  | 'squat'
  | 'hinge'
  | 'core_plank'
  | 'core_rotation'
  | 'mobility_flow'
  | 'cardio_stride'
  | 'stretch_reach';

export interface Equipment {
  id: string;
  gymId: string;
  name: string;
  category: EquipmentCategory;
  weightUnit: WeightUnit;
  /** Exact selectable weights in equipment's weightUnit (empty for bodyweight/cardio). */
  weightOptions: number[];
  isAvailable: boolean;
  notes?: string;
}

export interface Exercise {
  id: string;
  name: string;
  equipmentId: string;
  block: BlockType;
  pattern: MovementPattern;
  /** Optional; falls back to a default derived from `pattern` via resolvePlane(). */
  plane?: MovementPlane;
  primaryMuscles?: MuscleGroup[];
  repRange: [number, number];
  /** Used for timed exercises (warmup, cardio, stretches, planks). */
  durationSec?: number;
  isTimed?: boolean;
  visualKey: VisualKey;
  safetyCues: [string, string] | [string, string, string];
}

export interface PlannedSet {
  setNumber: number;
  targetWeight: number;
  targetReps: number;
  actualWeight: number;
  actualReps: number;
  completed: boolean;
}

export interface PlannedExercise {
  instanceId: string;
  exerciseId: string;
  isFirstTime: boolean;
  sets: PlannedSet[];
  effort?: EffortRating;
}

export interface WorkoutBlock {
  type: BlockType;
  title: string;
  estimatedMinutes: number;
  exercises: PlannedExercise[];
}

export interface WorkoutSession {
  id: string;
  gymId: string;
  status: SessionStatus;
  createdAt: string;
  completedAt?: string;
  durationMin: SessionDuration;
  blocks: WorkoutBlock[];
}

export interface ExerciseProgress {
  exerciseId: string;
  currentWeight: number;
  lastReps: number;
  lastEffort: EffortRating;
  isCalibrated: boolean;
  source: 'default' | 'calibrated' | 'logged';
  totalSessions: number;
  updatedAt: string;
}

export interface GymExportData {
  version: 1;
  exportedAt: string;
  equipment: Equipment[];
  exercises: Exercise[];
  sessions: WorkoutSession[];
  progress: ExerciseProgress[];
}
