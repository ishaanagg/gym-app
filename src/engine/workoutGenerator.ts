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

function getRecentlyUsedExerciseIds(sessions: WorkoutSession[], lookback = 2): Set<string> {
  const recent = new Set<string>();
  const completed = sessions.filter((s) => Boolean(s.completedAt)).slice(0, lookback);
  for (const session of completed) {
    for (const block of session.blocks) {
      for (const ex of block.exercises) {
        recent.add(ex.exerciseId);
      }
    }
  }
  return recent;
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

export function generateWorkoutSession(
  durationMin: SessionDuration,
  equipmentList: Equipment[],
  exerciseList: Exercise[],
  recentSessions: WorkoutSession[],
  progressMap: Record<string, ExerciseProgress>,
  rng: () => number = Math.random
): WorkoutSession {
  const equipmentMap = new Map(equipmentList.map((e) => [e.id, e]));
  const availableEquipmentIds = new Set(
    equipmentList.filter((e) => e.isAvailable).map((e) => e.id)
  );
  const eligibleExercises = exerciseList.filter((ex) =>
    availableEquipmentIds.has(ex.equipmentId)
  );

  const recentIds = getRecentlyUsedExerciseIds(recentSessions, 2);
  const pickedIds = new Set<string>();

  const config = {
    20: {
      warmupCount: 1,
      strengthSets: 2,
      strengthPatterns: ['upper_push', 'upper_pull', 'lower_squat'] as MovementPattern[],
      coreCount: 1,
      cardioMin: 3,
      stretchCount: 1,
    },
    30: {
      warmupCount: 2,
      strengthSets: 2,
      strengthPatterns: ['upper_push', 'upper_pull', 'lower_squat', 'lower_hinge'] as MovementPattern[],
      coreCount: 1,
      cardioMin: 4,
      stretchCount: 1,
    },
    45: {
      warmupCount: 2,
      strengthSets: 3,
      strengthPatterns: ['upper_push', 'upper_pull', 'lower_squat', 'lower_hinge'] as MovementPattern[],
      coreCount: 2,
      cardioMin: 6,
      stretchCount: 2,
    },
    60: {
      warmupCount: 3,
      strengthSets: 3,
      strengthPatterns: [
        'upper_push',
        'upper_pull',
        'lower_squat',
        'upper_push',
        'upper_pull',
        'lower_hinge',
      ] as MovementPattern[],
      coreCount: 2,
      cardioMin: 8,
      stretchCount: 2,
    },
  }[durationMin];

  const blocks: WorkoutBlock[] = [];

  // 1. Warm-up / Mobility
  const warmupExercises: PlannedExercise[] = [];
  const warmupPool = eligibleExercises.filter((e) => e.block === 'warmup');
  for (let i = 0; i < config.warmupCount; i++) {
    const chosen = pickRotatedExercise(warmupPool, recentIds, pickedIds, rng);
    if (chosen) {
      pickedIds.add(chosen.id);
      warmupExercises.push(buildPlannedExercise(chosen, equipmentMap, progressMap, 1, rng));
    }
  }
  if (warmupExercises.length > 0) {
    blocks.push({
      type: 'warmup',
      title: 'Warm-up & Mobility',
      estimatedMinutes: config.warmupCount * 2,
      exercises: warmupExercises,
    });
  }

  // 2. Strength Stations (alternating Push / Pull / Lower)
  const strengthExercises: PlannedExercise[] = [];
  const strengthPool = eligibleExercises.filter((e) => e.block === 'strength');

  for (const pattern of config.strengthPatterns) {
    const candidates = strengthPool.filter((e) => e.pattern === pattern);
    const chosen = pickRotatedExercise(candidates, recentIds, pickedIds, rng);
    if (chosen) {
      pickedIds.add(chosen.id);
      strengthExercises.push(
        buildPlannedExercise(chosen, equipmentMap, progressMap, config.strengthSets, rng)
      );
    }
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
  const coreExercises: PlannedExercise[] = [];
  const corePool = eligibleExercises.filter((e) => e.block === 'core');
  for (let i = 0; i < config.coreCount; i++) {
    const chosen = pickRotatedExercise(corePool, recentIds, pickedIds, rng);
    if (chosen) {
      pickedIds.add(chosen.id);
      coreExercises.push(buildPlannedExercise(chosen, equipmentMap, progressMap, 2, rng));
    }
  }
  if (coreExercises.length > 0) {
    blocks.push({
      type: 'core',
      title: 'Abs & Core',
      estimatedMinutes: config.coreCount * 3,
      exercises: coreExercises,
    });
  }

  // 4. Cardio Cooldown
  const cardioPool = eligibleExercises.filter((e) => e.block === 'cardio');
  const cardioChosen = pickRotatedExercise(cardioPool, recentIds, pickedIds, rng);
  if (cardioChosen) {
    pickedIds.add(cardioChosen.id);
    blocks.push({
      type: 'cardio',
      title: 'Cardio Cooldown',
      estimatedMinutes: config.cardioMin,
      exercises: [buildPlannedExercise(cardioChosen, equipmentMap, progressMap, 1, rng)],
    });
  }

  // 5. Stretching / Flexibility
  const stretchExercises: PlannedExercise[] = [];
  const stretchPool = eligibleExercises.filter((e) => e.block === 'stretch');
  for (let i = 0; i < config.stretchCount; i++) {
    const chosen = pickRotatedExercise(stretchPool, recentIds, pickedIds, rng);
    if (chosen) {
      pickedIds.add(chosen.id);
      stretchExercises.push(buildPlannedExercise(chosen, equipmentMap, progressMap, 1, rng));
    }
  }
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
    createdAt: new Date().toISOString(),
    durationMin,
    blocks,
  };
}

export function getSwapCandidates(
  currentExercise: Exercise,
  blockType: BlockType,
  currentSession: WorkoutSession,
  equipmentList: Equipment[],
  exerciseList: Exercise[]
): Exercise[] {
  const availableEq = new Set(equipmentList.filter((e) => e.isAvailable).map((e) => e.id));
  const usedIds = new Set<string>();
  for (const b of currentSession.blocks) {
    for (const pe of b.exercises) usedIds.add(pe.exerciseId);
  }

  return exerciseList.filter((ex) => {
    if (!availableEq.has(ex.equipmentId)) return false;
    if (ex.id === currentExercise.id || usedIds.has(ex.id)) return false;
    if (blockType === 'strength') {
      return ex.block === 'strength' && ex.pattern === currentExercise.pattern;
    }
    return ex.block === blockType;
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
