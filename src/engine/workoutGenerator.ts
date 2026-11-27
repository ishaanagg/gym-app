import { DEFAULT_GYM_ID } from '../data/defaultInventory';
import type {
  BlockType,
  EffortRating,
  Equipment,
  Exercise,
  ExerciseProgress,
  MovementPattern,
  MuscleGroup,
  PlannedExercise,
  PlannedSet,
  SessionDuration,
  SessionIntensity,
  SessionOptions,
  TargetArea,
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
  resolveTargetAreas,
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

/**
 * Adjusts base double-progression prescription for today's chosen session intensity:
 * - light: steps down 1 plate increment (when available) at minReps for restorative form
 * - medium: standard double-progression working weight and reps
 * - hard: working weight pushed to top of repRange (maxReps)
 */
export function applyIntensityToTarget(
  base: { weight: number; reps: number; isFirstTime: boolean },
  exercise: Exercise,
  equipment: Equipment | undefined,
  intensity: SessionIntensity
): { weight: number; reps: number; isFirstTime: boolean } {
  if (intensity === 'medium') return base;

  const [minReps, maxReps] = exercise.repRange;
  const sortedWeights = equipment ? [...equipment.weightOptions].sort((a, b) => a - b) : [];

  if (intensity === 'light') {
    if (sortedWeights.length > 0 && base.weight > 0) {
      const idx = sortedWeights.indexOf(snapToAvailableWeight(base.weight, equipment));
      const lighterWeight = sortedWeights[Math.max(0, idx - 1)];
      return { weight: lighterWeight, reps: minReps, isFirstTime: base.isFirstTime };
    }
    return { weight: 0, reps: minReps, isFirstTime: base.isFirstTime };
  }

  return {
    weight: base.weight,
    reps: maxReps,
    isFirstTime: base.isFirstTime,
  };
}

export function buildPlannedExercise(
  exercise: Exercise,
  equipmentMap: Map<string, Equipment>,
  progressMap: Record<string, ExerciseProgress>,
  setCount: number,
  rng: () => number = Math.random,
  intensity: SessionIntensity = 'medium'
): PlannedExercise {
  const equipment = equipmentMap.get(exercise.equipmentId);
  const baseTarget = getNextTarget(exercise, equipment, progressMap[exercise.id]);
  const { weight, reps, isFirstTime } = applyIntensityToTarget(
    baseTarget,
    exercise,
    equipment,
    intensity
  );

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

/**
 * Context-aware picker for Warm-up, Core, Cardio, and Flexibility:
 * 1. Dedicated cardio/cable gear ahead of floor-mat fallback (for cardio block)
 * 2. Not used in the last 2 sessions
 * 3. Best overlap with today's trained muscles (primes & decompresses the exact joints worked!)
 * 4. rng tie-break
 */
function pickContextualExercise(
  candidates: Exercise[],
  recentIds: Set<string>,
  alreadyPickedIds: Set<string>,
  trainedMuscles: Set<MuscleGroup>,
  rng: () => number,
  preferMachineOverMat = false
): Exercise | undefined {
  const available = candidates.filter((c) => !alreadyPickedIds.has(c.id));
  if (available.length === 0) return undefined;

  const keyed = available.map((ex) => {
    const fallbackTier = preferMachineOverMat && ex.equipmentId === 'eq-mat' ? 1 : 0;
    const repeat = recentIds.has(ex.id) ? 1 : 0;
    const hasOverlap =
      trainedMuscles.size > 0 && ex.primaryMuscles?.some((m) => trainedMuscles.has(m)) ? 0 : 1;
    return { ex, fallbackTier, repeat, hasOverlap };
  });

  const minFallback = Math.min(...keyed.map((k) => k.fallbackTier));
  const t0 = keyed.filter((k) => k.fallbackTier === minFallback);
  const minRepeat = Math.min(...t0.map((k) => k.repeat));
  const t1 = t0.filter((k) => k.repeat === minRepeat);
  const minOverlap = Math.min(...t1.map((k) => k.hasOverlap));
  const tied = t1.filter((k) => k.hasOverlap === minOverlap);

  const idx = Math.min(tied.length - 1, Math.floor(rng() * tied.length));
  return tied[idx].ex;
}

type StrengthSlot = MovementPattern | 'lower_any';

const STRENGTH_SLOTS: Record<SessionDuration, StrengthSlot[]> = {
  20: ['upper_push', 'upper_pull', 'lower_any'],
  30: ['upper_push', 'upper_pull', 'lower_squat', 'lower_hinge'],
  45: ['upper_push', 'upper_pull', 'lower_squat', 'lower_hinge'],
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

const TARGET_STRENGTH_SLOTS: Record<SessionIntensity, Record<SessionDuration, number>> = {
  light: { 20: 2, 30: 3, 45: 4, 60: 5 },
  medium: { 20: 3, 30: 4, 45: 4, 60: 6 },
  hard: { 20: 3, 30: 4, 45: 5, 60: 6 },
};

export function generateWorkoutSession(
  durationMin: SessionDuration,
  equipmentList: Equipment[],
  exerciseList: Exercise[],
  recentSessions: WorkoutSession[],
  progressMap: Record<string, ExerciseProgress>,
  rng: () => number = Math.random,
  now: () => Date = () => new Date(),
  options?: SessionOptions
): WorkoutSession {
  const intensity: SessionIntensity = options?.intensity ?? 'medium';
  const targets: TargetArea[] = options?.targets ?? [];

  const equipmentMap = new Map(equipmentList.map((e) => [e.id, e]));
  const exerciseMap = new Map(exerciseList.map((e) => [e.id, e]));
  const availableEquipmentIds = new Set(
    equipmentList.filter((e) => e.isAvailable).map((e) => e.id)
  );

  // Floor bodyweight movements ('eq-mat') remain available as an ultimate safety net even if
  // every machine in My Gym was removed, unless explicitly toggled off while other gear exists.
  const matExplicitlyOff = equipmentList.some((e) => e.id === 'eq-mat' && !e.isAvailable);
  const eligibleExercises = exerciseList.filter(
    (ex) =>
      availableEquipmentIds.has(ex.equipmentId) ||
      (ex.equipmentId === 'eq-mat' && !matExplicitlyOff)
  );
  const emergencyFloorPool = exerciseList.filter((ex) => ex.equipmentId === 'eq-mat');

  const recentIds = getRecentActiveExerciseIds(recentSessions, 2);
  const planeHistory = computePlaneRecency(recentSessions, exerciseMap);
  const sessionPicks = emptyPlaneScores();
  const sessionMuscleCounts: Partial<Record<MuscleGroup, number>> = {};
  const trainedMuscles = new Set<MuscleGroup>();
  const pickedIds = new Set<string>();
  const baseConfig = BLOCK_CONFIG[durationMin];

  const strengthSets =
    intensity === 'light'
      ? 2
      : intensity === 'hard'
      ? baseConfig.strengthSets + 1
      : baseConfig.strengthSets;

  const coreSets = intensity === 'hard' ? 3 : 2;
  const cardioMin =
    intensity === 'light'
      ? Math.max(2, baseConfig.cardioMin - 1)
      : intensity === 'hard'
      ? baseConfig.cardioMin + 2
      : baseConfig.cardioMin;

  const recordStrengthPick = (chosen: Exercise) => {
    pickedIds.add(chosen.id);
    const plane = resolvePlane(chosen);
    if (plane) sessionPicks[plane] += 1;
    for (const m of chosen.primaryMuscles ?? []) {
      trainedMuscles.add(m);
    }
    const leadMuscle = chosen.primaryMuscles?.[0];
    if (leadMuscle) {
      sessionMuscleCounts[leadMuscle] = (sessionMuscleCounts[leadMuscle] ?? 0) + 1;
    }
  };

  // Step A: Select Strength Stations first so Warm-up & Flexibility can prime/decompress them!
  const strengthExercises: PlannedExercise[] = [];
  let strengthPool = eligibleExercises.filter((e) => e.block === 'strength');
  if (strengthPool.length === 0) {
    strengthPool = emergencyFloorPool.filter((e) => e.block === 'strength');
  }

  const strengthTargets: TargetArea[] = targets.filter((t) => t !== 'abs');
  const absOnly = targets.length === 1 && targets[0] === 'abs';

  const emergencyStrengthPool = emergencyFloorPool.filter((e) => e.block === 'strength');

  if (targets.length === 0) {
    const slots =
      intensity === 'light' && durationMin === 30
        ? (['upper_push', 'upper_pull', 'lower_any'] as StrengthSlot[])
        : STRENGTH_SLOTS[durationMin];

    for (const slot of slots) {
      const pattern: MovementPattern =
        slot === 'lower_any' ? chooseLowerPattern(planeHistory, sessionPicks) : slot;
      let candidates = strengthPool.filter((e) => e.pattern === pattern && !pickedIds.has(e.id));
      if (candidates.length === 0 && slot === 'lower_any') {
        const other = pattern === 'lower_squat' ? 'lower_hinge' : 'lower_squat';
        candidates = strengthPool.filter((e) => e.pattern === other && !pickedIds.has(e.id));
      }
      if (candidates.length === 0) {
        candidates = emergencyStrengthPool.filter(
          (e) =>
            !pickedIds.has(e.id) &&
            (e.pattern === pattern ||
              (slot === 'lower_any' &&
                (e.pattern === 'lower_squat' || e.pattern === 'lower_hinge')))
        );
      }
      const chosen = pickBalancedExercise(
        candidates,
        recentIds,
        planeHistory,
        sessionPicks,
        rng,
        sessionMuscleCounts
      );
      if (!chosen) continue;
      recordStrengthPick(chosen);
      strengthExercises.push(
        buildPlannedExercise(chosen, equipmentMap, progressMap, strengthSets, rng, intensity)
      );
    }
  } else if (absOnly) {
    const supportSlots: StrengthSlot[] =
      durationMin >= 45 ? ['upper_pull', 'lower_any'] : ['lower_any'];
    for (const slot of supportSlots) {
      const pattern: MovementPattern =
        slot === 'lower_any' ? chooseLowerPattern(planeHistory, sessionPicks) : slot;
      let candidates = strengthPool.filter((e) => e.pattern === pattern && !pickedIds.has(e.id));
      if (candidates.length === 0 && slot === 'lower_any') {
        const other = pattern === 'lower_squat' ? 'lower_hinge' : 'lower_squat';
        candidates = strengthPool.filter((e) => e.pattern === other && !pickedIds.has(e.id));
      }
      if (candidates.length === 0) {
        candidates = emergencyStrengthPool.filter((e) => !pickedIds.has(e.id));
      }
      const chosen = pickBalancedExercise(
        candidates,
        recentIds,
        planeHistory,
        sessionPicks,
        rng,
        sessionMuscleCounts
      );
      if (!chosen) continue;
      recordStrengthPick(chosen);
      strengthExercises.push(
        buildPlannedExercise(chosen, equipmentMap, progressMap, strengthSets, rng, intensity)
      );
    }
  } else {
    const slotCount = TARGET_STRENGTH_SLOTS[intensity][durationMin];

    for (let i = 0; i < slotCount; i++) {
      const targetArea = strengthTargets[i % strengthTargets.length];
      const unused = strengthPool.filter((e) => !pickedIds.has(e.id));

      let candidates = unused.filter((ex) =>
        resolveTargetAreas(ex).primary.includes(targetArea)
      );

      if (candidates.length === 0) {
        candidates = unused.filter((ex) =>
          resolveTargetAreas(ex).secondary.includes(targetArea)
        );
      }

      if (candidates.length === 0 && strengthTargets.length > 1) {
        candidates = unused.filter((ex) =>
          resolveTargetAreas(ex).primary.some((a) => strengthTargets.includes(a))
        );
      }

      // Per-slot floor bodyweight fallback when every machine for this target area is off
      if (candidates.length === 0) {
        const unusedFloor = emergencyStrengthPool.filter((e) => !pickedIds.has(e.id));
        candidates = unusedFloor.filter((ex) => {
          const areas = resolveTargetAreas(ex);
          return areas.primary.includes(targetArea) || areas.secondary.includes(targetArea);
        });
        if (candidates.length === 0) {
          candidates = unused.length > 0 ? unused : unusedFloor;
        }
      }

      const chosen = pickBalancedExercise(
        candidates,
        recentIds,
        planeHistory,
        sessionPicks,
        rng,
        sessionMuscleCounts
      );
      if (!chosen) continue;
      recordStrengthPick(chosen);
      strengthExercises.push(
        buildPlannedExercise(chosen, equipmentMap, progressMap, strengthSets, rng, intensity)
      );
    }
  }

  // Step B: Pick Session-Matched Warm-up, Core, Cardio & Flexibility
  const pickBlock = (
    block: BlockType,
    count: number,
    sets: number,
    preferMachine = false
  ): PlannedExercise[] => {
    let pool = eligibleExercises.filter((e) => e.block === block);
    if (pool.length === 0) pool = emergencyFloorPool.filter((e) => e.block === block);

    const out: PlannedExercise[] = [];
    for (let i = 0; i < count; i++) {
      const chosen = pickContextualExercise(
        pool,
        recentIds,
        pickedIds,
        trainedMuscles,
        rng,
        preferMachine
      );
      if (!chosen) break;
      pickedIds.add(chosen.id);
      out.push(buildPlannedExercise(chosen, equipmentMap, progressMap, sets, rng, intensity));
    }
    return out;
  };

  const warmupExercises = pickBlock('warmup', baseConfig.warmupCount, 1);

  const wantsAbs = targets.includes('abs');
  const coreCount = absOnly
    ? durationMin >= 45
      ? 4
      : 3
    : wantsAbs
    ? Math.min(4, baseConfig.coreCount + 1)
    : baseConfig.coreCount;
  const coreExercises = pickBlock('core', coreCount, coreSets);

  const cardioExercises = pickBlock('cardio', 1, 1, true);

  const stretchCount =
    intensity === 'light' ? Math.max(2, baseConfig.stretchCount) : baseConfig.stretchCount;
  const stretchExercises = pickBlock('stretch', stretchCount, 1);

  // Assemble in canonical 5-phase holistic order: Warm-up -> Strength -> Core -> Cardio -> Flexibility
  const blocks: WorkoutBlock[] = [];

  if (warmupExercises.length > 0) {
    blocks.push({
      type: 'warmup',
      title: 'Warm-up & Mobility',
      estimatedMinutes: warmupExercises.length * 2,
      exercises: warmupExercises,
    });
  }

  if (strengthExercises.length > 0) {
    blocks.push({
      type: 'strength',
      title: 'Strength Stations',
      estimatedMinutes: Math.max(6, strengthExercises.length * strengthSets * 2),
      exercises: strengthExercises,
    });
  }

  if (coreExercises.length > 0) {
    blocks.push({
      type: 'core',
      title: 'Abs & Core',
      estimatedMinutes: coreExercises.length * 3,
      exercises: coreExercises,
    });
  }

  if (cardioExercises.length > 0) {
    blocks.push({
      type: 'cardio',
      title: 'Cardio Cooldown',
      estimatedMinutes: cardioMin,
      exercises: cardioExercises,
    });
  }

  if (stretchExercises.length > 0) {
    blocks.push({
      type: 'stretch',
      title: 'Flexibility & Reset',
      estimatedMinutes: stretchExercises.length * 2,
      exercises: stretchExercises,
    });
  }

  return {
    id: uid('session', rng),
    gymId: DEFAULT_GYM_ID,
    status: 'planned',
    createdAt: now().toISOString(),
    durationMin,
    intensity,
    targets,
    blocks,
  };
}

/**
 * Swap candidates for an occupied machine. Preserves macro focus / movement pattern and
 * orders by: loaded equipment before floor fallback, same pattern, same plane, not recent, lowest score.
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

  const currentPrimary = resolveTargetAreas(currentExercise).primary;

  const candidates = exerciseList.filter((ex) => {
    if (!availableEq.has(ex.equipmentId)) return false;
    if (ex.id === currentExercise.id || usedIds.has(ex.id)) return false;
    if (blockType === 'strength') {
      if (ex.block !== 'strength') return false;
      if (currentExercise.pattern === 'upper_isolation') {
        return resolveTargetAreas(ex).primary.some((a) => currentPrimary.includes(a));
      }
      return (
        ex.pattern === currentExercise.pattern ||
        resolveTargetAreas(ex).primary.some((a) => currentPrimary.includes(a))
      );
    }
    return ex.block === blockType;
  });

  if (!recentSessions) return candidates;

  const exerciseMap = new Map(exerciseList.map((e) => [e.id, e]));
  const recentIds = getRecentActiveExerciseIds(recentSessions, 2);
  const history = computePlaneRecency(recentSessions, exerciseMap);
  const currentPlane = resolvePlane(currentExercise);

  const rank = (ex: Exercise): [number, number, number, number, number] => {
    const plane = resolvePlane(ex);
    return [
      ex.block === 'strength' && ex.equipmentId === 'eq-mat' ? 1 : 0,
      ex.pattern === currentExercise.pattern ? 0 : 1,
      plane === currentPlane ? 0 : 1,
      recentIds.has(ex.id) ? 1 : 0,
      plane ? history[plane] : 0,
    ];
  };

  return [...candidates].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2] || ra[3] - rb[3] || ra[4] - rb[4];
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
