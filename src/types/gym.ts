export type EquipmentCategory = 'machine' | 'free_weight' | 'cardio' | 'bodyweight';

export type WeightUnit = 'lbs' | 'kg';

export type MovementPattern =
  | 'upper_push'
  | 'upper_pull'
  | 'upper_isolation'
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

/** User-selectable macro focus areas on Today screen. Empty array = Balanced full-body. */
export type TargetArea = 'legs' | 'chest' | 'back' | 'shoulders' | 'arms' | 'abs';

export type SessionIntensity = 'light' | 'medium' | 'hard';

export interface SessionOptions {
  targets?: TargetArea[];
  intensity?: SessionIntensity;
}

export type BlockType = 'warmup' | 'strength' | 'core' | 'cardio' | 'stretch';

export type SessionDuration = 20 | 30 | 45 | 60;

export type EffortRating = 'easy' | 'just_right' | 'too_hard';

export type SessionStatus = 'planned' | 'in_progress' | 'completed';

export type VisualKey =
  | 'cat_cow'
  | 'worlds_greatest'
  | 'squat_to_stand'
  | 'wall_slides'
  | 'chest_press'
  | 'pushup'
  | 'pike_pushup'
  | 'overhead_press'
  | 'lateral_raise'
  | 'lat_pulldown'
  | 'seated_row'
  | 'bent_row'
  | 'face_pull'
  | 'prone_ytw'
  | 'arm_curl'
  | 'tricep_extension'
  | 'squat'
  | 'leg_press'
  | 'leg_extension'
  | 'leg_curl'
  | 'lunge_split'
  | 'lateral_lunge'
  | 'hinge'
  | 'glute_bridge'
  | 'dead_bug'
  | 'core_plank'
  | 'core_rotation'
  | 'suitcase_carry'
  | 'cardio_stride'
  | 'bike_spin'
  | 'hip_flexor_stretch'
  | 'childs_pose'
  | 'chest_opener'
  | 'figure_four'
  | 'mobility_flow'
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
  intensity?: SessionIntensity;
  targets?: TargetArea[];
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

export interface AppSettings {
  userName: string;
  gymName: string;
  /** True once the user finishes or skips the first-run onboarding flow. */
  onboardingCompleted?: boolean;
  /** ISO timestamp of the last successful cloud backup (any provider). */
  lastCloudBackupAt?: string;
  /** Remembers that the user opted into Google Drive backup (no tokens are stored). */
  driveBackupEnabled?: boolean;
}

export interface GymExportData {
  version: 1;
  exportedAt: string;
  equipment: Equipment[];
  exercises: Exercise[];
  sessions: WorkoutSession[];
  progress: ExerciseProgress[];
  /** Optional so older v1 backups (without settings) still import. */
  settings?: AppSettings;
}
