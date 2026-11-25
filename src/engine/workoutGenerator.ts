import { DEFAULT_GYM_ID } from '../data/defaultInventory';
import type {
  BlockType,
  EffortRating,
  Equipment,
  Exercise,
  ExerciseProgress,
  MovementPattern,
  PlannedExercise,
  PlannedSet,
  SessionDuration,
  WorkoutBlock,
  WorkoutSession,
} from '../types/gym';
import {
  chooseLowerPattern,
  computePlaneRecency,
  emptyPlaneScores,
  getRecentActiveExerciseIds,
  pickBalancedExercise,
  resolvePlane,
} from './balance';

function uid(prefix: string, rng: () => number = Math.random): string {
  return `${prefix}-${Math.floor(rng() * 1e9).toString(36)}`;
}

/**
 * Picks a safe ~25% starting weight snapped to the machine's exact weightOptions.
 */
export function getInitialWeight(equipment?: Equipment): number {
  if (!equipment || equipment.weightOptions.length === 0) return 0;
  const sorted = [...equipment.weightOptions].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * 0.25)));
  return sorted[idx];
}

/**
 * Snap any numeric weight to the closest available plate in equipment.weightOptions.
 */
export function snapToAvailableWeight(weight: number, equipment?: Equipment): number {
  if (!equipment || equipment.weightOptions.length === 0) return 0;
  const sorted = [...equipment.weightOptions].sort((a, b) => a - b);
  return sorted.reduce((prev, curr) =>
    Math.abs(curr - weight) < Math.abs(prev - weight) ? curr : prev
  );
}

/**
 * Exact-plate double progression:
 * - Easy + top of rep range -> next available plate in weightOptions at bottom of rep range
 * - Just Right -> hold weight, +1 rep (up to top of rep range)
 * - Too Hard -> hold weight or step down 1 plate if at bottom of rep range
 */
export function getNextTarget(
  exercise: Exercise,
  equipment: Equipment | undefined,
  progress: ExerciseProgress | undefined
): { weight: number; reps: number; isFirstTime: boolean } {
  const [minReps, maxReps] = exercise.repRange;

  if (!progress) {
    return {
      weight: getInitialWeight(equipment),
      reps: minReps,
      isFirstTime: true,
    };
  }

  const sortedWeights = equipment ? [...equipment.weightOptions].sort((a, b) => a - b) : [];
  const currentIdx = sortedWeights.indexOf(snapToAvailableWeight(progress.currentWeight, equipment));

  if (sortedWeights.length === 0) {
    let nextReps = progress.lastReps;
    if (progress.lastEffort === 'easy') {
      nextReps = Math.min(maxReps, progress.lastReps + 1);
    } else if (progress.lastEffort === 'too_hard') {
      nextReps = Math.max(minReps, progress.lastReps - 1);
    }
    return { weight: 0, reps: nextReps, isFirstTime: false };
  }

  const currentWeight = sortedWeights[currentIdx >= 0 ? currentIdx : 0];
  let nextWeight = currentWeight;
  let nextReps = progress.lastReps;

  if (progress.lastEffort === 'easy') {
    if (progress.lastReps >= maxReps && currentIdx >= 0 && currentIdx < sortedWeights.length - 1) {
      nextWeight = sortedWeights[currentIdx + 1];
      nextReps = minReps;
    } else {
      nextReps = Math.min(maxReps, progress.lastReps + 1);
    }
  } else if (progress.lastEffort === 'just_right') {
    nextReps = Math.min(maxReps, progress.lastReps + 1);
  } else if (progress.lastEffort === 'too_hard') {
    if (progress.lastReps <= minReps && currentIdx > 0) {
      nextWeight = sortedWeights[currentIdx - 1];
      nextReps = minReps;
    } else {
      nextReps = Math.max(minReps, progress.lastReps - 1);
    }
  }

  return { weight: nextWeight, reps: nextReps, isFirstTime: false };
}

export function buildPlannedExercise(
  exercise: Exercise,
  equipmentMap: Map<string, Equipment>,
  progressMap: Record<string, ExerciseProgress>,
  setCount: number,
  rng: () => number = Math.random
): PlannedExercise {
  const equipment = equipmentMap.get(exercise.equipmentId);
  const { weight, reps, isFirstTime } = getNextTarget(exercise, equipment, progressMap[exercise.id]);

  const sets: PlannedSet[] = Array.from({ length: setCount }, (_, idx) => ({
    setNumber: idx + 1,
    targetWeight: weight,
    targetReps: reps,
    actualWeight: weight,
    actualReps: reps,
    completed: false,
  }));

  return {
    instanceId: uid('pe', rng),
    exerciseId: exercise.id,
    isFirstTime,
    sets,
  };
}

function pickRotatedExercise(
  candidates: Exercise[],
  recentIds: Set<string>,
  alreadyPickedIds: Set<string>,
  rng: () => number
): Exercise | undefined {
  const available = candidates.filter((c) => !alreadyPickedIds.has(c.id));
  if (available.length === 0) return undefined;

  const fresh = available.filter((c) => !recentIds.has(c.id));
  const pool = fresh.length > 0 ? fresh : available;
  const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[idx];
}

type StrengthSlot = MovementPattern | 'lower_any';

const STRENGTH_SLOTS: Record<SessionDuration, StrengthSlot[]> = {
  // 20-min has one lower slot: pick squat vs hinge by whichever was trained less recently.
  20: ['upper_push', 'upper_pull', 'lower_any'],
  30: ['upper_push', 'upper_pull', 'lower_squat', 'lower_hinge'],
  45: ['upper_push', 'upper_pull', 'lower_squat', 'lower_hinge'],
  // Doubled push/pull: the in-session running score forces the opposite plane on the 2nd pick.
  60: ['upper_push', 'upper_pull', 'lower_squat', 'upper_push', 'upper_pull', 'lower_hinge'],
};

const BLOCK_CONFIG: Record<
  SessionDuration,
  { warmupCount: number; strengthSets: number; coreCount: number; cardioMin: number; stretchCount: number }
> = {
  20: { warmupCount: 1, strengthSets: 2, coreCount: 1, cardioMin: 3, stretchCount: 1 },
  30: { warmupCount: 2, strengthSets: 2, coreCount: 1, cardioMin: 4, stretchCount: 1 },
  45: { warmupCount: 2, strengthSets: 3, coreCount: 2, cardioMin: 6, stretchCount: 2 },
  60: { warmupCount: 3, strengthSets: 3, coreCount: 2, cardioMin: 8, stretchCount: 2 },
};

export function generateWorkoutSession(
  durationMin: SessionDuration,
  equipmentList: Equipment[],
  exerciseList: Exercise[],
  recentSessions: WorkoutSession[],
  progressMap: Record<string, ExerciseProgress>,
  rng: () => number = Math.random,
  now: () => Date = () => new Date()
): WorkoutSession {
  const equipmentMap = new Map(equipmentList.map((e) => [e.id, e]));
  const exerciseMap = new Map(exerciseList.map((e) => [e.id, e]));
  const availableEquipmentIds = new Set(
    equipmentList.filter((e) => e.isAvailable).map((e) => e.id)
  );
  const eligibleExercises = exerciseList.filter((ex) =>
    availableEquipmentIds.has(ex.equipmentId)
  );

  const recentIds = getRecentActiveExerciseIds(recentSessions, 2);
  const planeHistory = computePlaneRecency(recentSessions, exerciseMap);
  const sessionPicks = emptyPlaneScores();
  const pickedIds = new Set<string>();
  const config = BLOCK_CONFIG[durationMin];

  const blocks: WorkoutBlock[] = [];

  const pickSimpleBlock = (block: BlockType, count: number, sets: number): PlannedExercise[] => {
    const pool = eligibleExercises.filter((e) => e.block === block);
    const out: PlannedExercise[] = [];
    for (let i = 0; i < count; i++) {
      const chosen = pickRotatedExercise(pool, recentIds, pickedIds, rng);
      if (!chosen) break;
      pickedIds.add(chosen.id);
      out.push(buildPlannedExercise(chosen, equipmentMap, progressMap, sets, rng));
    }
    return out;
  };

  // 1. Warm-up / Mobility
  const warmupExercises = pickSimpleBlock('warmup', config.warmupCount, 1);
  if (warmupExercises.length > 0) {
    blocks.push({
      type: 'warmup',
      title: 'Warm-up & Mobility',
      estimatedMinutes: config.warmupCount * 2,
      exercises: warmupExercises,
    });
  }

  // 2. Strength Stations — balanced against the previous 2 sessions by movement plane
  const strengthExercises: PlannedExercise[] = [];
  const strengthPool = eligibleExercises.filter((e) => e.block === 'strength');

  for (const slot of STRENGTH_SLOTS[durationMin]) {
    const pattern: MovementPattern =
      slot === 'lower_any' ? chooseLowerPattern(planeHistory, sessionPicks) : slot;
    let candidates = strengthPool.filter((e) => e.pattern === pattern && !pickedIds.has(e.id));
    if (candidates.length === 0 && slot === 'lower_any') {
      // Fall back to the other lower pattern if equipment for the preferred one is unavailable
      const other = pattern === 'lower_squat' ? 'lower_hinge' : 'lower_squat';
      candidates = strengthPool.filter((e) => e.pattern === other && !pickedIds.has(e.id));
    }
    const chosen = pickBalancedExercise(candidates, recentIds, planeHistory, sessionPicks, rng);
    if (!chosen) continue;
    pickedIds.add(chosen.id);
    const plane = resolvePlane(chosen);
    if (plane) sessionPicks[plane] += 1;
    strengthExercises.push(
      buildPlannedExercise(chosen, equipmentMap, progressMap, config.strengthSets, rng)
    );
  }

  if (strengthExercises.length > 0) {
    blocks.push({
      type: 'strength',
      title: 'Strength Stations',
      estimatedMinutes: Math.round(durationMin * 0.55),
      exercises: strengthExercises,
    });
  }

  // 3. Abs / Core
  const coreExercises = pickSimpleBlock('core', config.coreCount, 2);
  if (coreExercises.length > 0) {
    blocks.push({
      type: 'core',
      title: 'Abs & Core',
      estimatedMinutes: config.coreCount * 3,
      exercises: coreExercises,
    });
  }

  // 4. Cardio Cooldown
  const cardioExercises = pickSimpleBlock('cardio', 1, 1);
  if (cardioExercises.length > 0) {
    blocks.push({
      type: 'cardio',
      title: 'Cardio Cooldown',
      estimatedMinutes: config.cardioMin,
      exercises: cardioExercises,
    });
  }

  // 5. Stretching / Flexibility
  const stretchExercises = pickSimpleBlock('stretch', config.stretchCount, 1);
  if (stretchExercises.length > 0) {
    blocks.push({
      type: 'stretch',
      title: 'Flexibility & Reset',
      estimatedMinutes: config.stretchCount * 2,
      exercises: stretchExercises,
    });
  }

  return {
    id: uid('session', rng),
    gymId: DEFAULT_GYM_ID,
    status: 'planned',
    createdAt: now().toISOString(),
    durationMin,
    blocks,
  };
}

/**
 * Swap candidates for an occupied machine. When recentSessions is provided, candidates are
 * ordered to preserve balance: same plane first, then not recently used, then lowest plane score.
 */
export function getSwapCandidates(
  currentExercise: Exercise,
  blockType: BlockType,
  currentSession: WorkoutSession,
  equipmentList: Equipment[],
  exerciseList: Exercise[],
  recentSessions?: WorkoutSession[]
): Exercise[] {
  const availableEq = new Set(equipmentList.filter((e) => e.isAvailable).map((e) => e.id));
  const usedIds = new Set<string>();
  for (const b of currentSession.blocks) {
    for (const pe of b.exercises) usedIds.add(pe.exerciseId);
  }

  const candidates = exerciseList.filter((ex) => {
    if (!availableEq.has(ex.equipmentId)) return false;
    if (ex.id === currentExercise.id || usedIds.has(ex.id)) return false;
    if (blockType === 'strength') {
      return ex.block === 'strength' && ex.pattern === currentExercise.pattern;
    }
    return ex.block === blockType;
  });

  if (!recentSessions) return candidates;

  const exerciseMap = new Map(exerciseList.map((e) => [e.id, e]));
  const recentIds = getRecentActiveExerciseIds(recentSessions, 2);
  const history = computePlaneRecency(recentSessions, exerciseMap);
  const currentPlane = resolvePlane(currentExercise);

  const rank = (ex: Exercise): [number, number, number] => {
    const plane = resolvePlane(ex);
    return [
      plane === currentPlane ? 0 : 1,
      recentIds.has(ex.id) ? 1 : 0,
      plane ? history[plane] : 0,
    ];
  };

  return [...candidates].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2];
  });
}

export function computeUpdatedProgress(
  planned: PlannedExercise,
  effort: EffortRating
): ExerciseProgress {
  const completedSets = planned.sets.filter((s) => s.completed);
  const refSets = completedSets.length > 0 ? completedSets : planned.sets;
  const maxWeight = Math.max(...refSets.map((s) => s.actualWeight));
  const avgReps = Math.round(
    refSets.reduce((sum, s) => sum + s.actualReps, 0) / Math.max(1, refSets.length)
  );

  return {
    exerciseId: planned.exerciseId,
    currentWeight: maxWeight,
    lastReps: avgReps,
    lastEffort: effort,
    isCalibrated: false,
    source: 'logged',
    totalSessions: 1,
    updatedAt: new Date().toISOString(),
  };
}
