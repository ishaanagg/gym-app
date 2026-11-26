import type {
  Exercise,
  MovementPattern,
  MovementPlane,
  MuscleGroup,
  PlannedExercise,
  TargetArea,
  WorkoutSession,
} from '../types/gym';

/**
 * Pure session-balancing helpers. No storage or React imports so the engine stays
 * deterministic, 100% offline, and unit-testable (rng is always injected by the caller).
 */

export const ALL_PLANES: MovementPlane[] = [
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'squat',
  'hinge',
];

const PATTERN_DEFAULT_PLANE: Partial<Record<MovementPattern, MovementPlane>> = {
  upper_push: 'horizontal_push',
  upper_pull: 'horizontal_pull',
  lower_squat: 'squat',
  lower_hinge: 'hinge',
};

/** Weight applied to planes/muscles already picked earlier in the same session (beats history). */
export const IN_SESSION_WEIGHT = 3;

export type PlaneScores = Record<MovementPlane, number>;

export function emptyPlaneScores(): PlaneScores {
  return {
    horizontal_push: 0,
    vertical_push: 0,
    horizontal_pull: 0,
    vertical_pull: 0,
    squat: 0,
    hinge: 0,
  };
}

/** Explicit tag wins; otherwise derive from pattern. Non-strength patterns resolve to undefined. */
export function resolvePlane(
  ex: Pick<Exercise, 'plane' | 'pattern'> | undefined
): MovementPlane | undefined {
  if (!ex) return undefined;
  return ex.plane ?? PATTERN_DEFAULT_PLANE[ex.pattern];
}

const MUSCLE_TO_AREA: Record<MuscleGroup, TargetArea> = {
  chest: 'chest',
  shoulders: 'shoulders',
  rear_delts: 'shoulders',
  lats: 'back',
  mid_back: 'back',
  biceps: 'arms',
  triceps: 'arms',
  quads: 'legs',
  glutes: 'legs',
  hamstrings: 'legs',
  core: 'abs',
};

/**
 * Maps any exercise (including untagged custom user exercises) to primary & synergistic
 * secondary macro TargetAreas so Focus filtering works offline with zero configuration.
 */
export function resolveTargetAreas(ex: Exercise): {
  primary: TargetArea[];
  secondary: TargetArea[];
} {
  if (ex.block === 'core') {
    return { primary: ['abs'], secondary: [] };
  }

  if (ex.primaryMuscles && ex.primaryMuscles.length > 0) {
    const firstArea = MUSCLE_TO_AREA[ex.primaryMuscles[0]];
    const primary: TargetArea[] = [firstArea];
    const secondary: TargetArea[] = [];

    for (let i = 1; i < ex.primaryMuscles.length; i++) {
      const area = MUSCLE_TO_AREA[ex.primaryMuscles[i]];
      if (area === firstArea) continue;
      // Compound lifts list synergists second (e.g. ['chest', 'triceps'] -> chest primary, arms secondary)
      if (!secondary.includes(area)) secondary.push(area);
    }
    return { primary, secondary };
  }

  // Fallback for custom exercises without explicit muscle tags
  const plane = resolvePlane(ex);
  if (ex.pattern === 'upper_isolation') return { primary: ['arms'], secondary: [] };
  if (plane === 'horizontal_push') return { primary: ['chest'], secondary: ['arms', 'shoulders'] };
  if (plane === 'vertical_push') return { primary: ['shoulders'], secondary: ['arms'] };
  if (plane === 'horizontal_pull' || plane === 'vertical_pull') {
    return { primary: ['back'], secondary: ['arms'] };
  }
  if (plane === 'squat' || plane === 'hinge') return { primary: ['legs'], secondary: [] };
  return { primary: [], secondary: [] };
}

/** Number of sets that actually count as work done. Skipped exercises return 0. */
export function completedWork(pe: PlannedExercise): number {
  const done = pe.sets.filter((s) => s.completed).length;
  if (done > 0) return done;
  return pe.effort ? pe.sets.length : 0;
}

/** Most recent completed sessions, sorted by completedAt desc (never trusts caller order). */
export function getRecentCompletedSessions(
  sessions: WorkoutSession[],
  lookback = 2
): WorkoutSession[] {
  return sessions
    .filter((s) => Boolean(s.completedAt))
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
    .slice(0, lookback);
}

/** Exercise ids with real activity in the last `lookback` completed sessions. */
export function getRecentActiveExerciseIds(sessions: WorkoutSession[], lookback = 2): Set<string> {
  const recent = new Set<string>();
  for (const session of getRecentCompletedSessions(sessions, lookback)) {
    for (const block of session.blocks) {
      for (const pe of block.exercises) {
        if (completedWork(pe) > 0) recent.add(pe.exerciseId);
      }
    }
  }
  return recent;
}

/**
 * Weighted strength volume per movement plane over the last 2 completed sessions.
 * Most recent session counts 2x, the one before 1x. Unknown/deleted exercises are ignored.
 */
export function computePlaneRecency(
  sessions: WorkoutSession[],
  exerciseMap: Map<string, Exercise>,
  weights: number[] = [2, 1]
): PlaneScores {
  const scores = emptyPlaneScores();
  const recent = getRecentCompletedSessions(sessions, weights.length);
  recent.forEach((session, i) => {
    for (const block of session.blocks) {
      if (block.type !== 'strength') continue;
      for (const pe of block.exercises) {
        const done = completedWork(pe);
        if (done === 0) continue;
        const plane = resolvePlane(exerciseMap.get(pe.exerciseId));
        if (!plane) continue;
        scores[plane] += weights[i] * done;
      }
    }
  });
  return scores;
}

/**
 * Ranking order for a strength slot:
 *   1. Not used in the last 2 sessions (no exact repeats)
 *   2. Lowest plane + lead-muscle score (alternates push/pull planes & biceps/triceps)
 *   3. rng tie-break among exact ties
 */
export function pickBalancedExercise(
  candidates: Exercise[],
  recentIds: Set<string>,
  history: PlaneScores,
  sessionPicks: PlaneScores,
  rng: () => number,
  sessionMuscleCounts?: Partial<Record<MuscleGroup, number>>
): Exercise | undefined {
  if (candidates.length === 0) return undefined;

  const keyed = candidates.map((ex) => {
    const plane = resolvePlane(ex);
    const planeScore = plane ? history[plane] + IN_SESSION_WEIGHT * sessionPicks[plane] : 0;
    const leadMuscle = ex.primaryMuscles?.[0];
    const muscleScore =
      leadMuscle && sessionMuscleCounts ? IN_SESSION_WEIGHT * (sessionMuscleCounts[leadMuscle] ?? 0) : 0;
    return { ex, repeat: recentIds.has(ex.id) ? 1 : 0, totalScore: planeScore + muscleScore };
  });

  const minRepeat = Math.min(...keyed.map((k) => k.repeat));
  const tier1 = keyed.filter((k) => k.repeat === minRepeat);
  const minScore = Math.min(...tier1.map((k) => k.totalScore));
  const tied = tier1.filter((k) => k.totalScore === minScore);

  const idx = Math.min(tied.length - 1, Math.floor(rng() * tied.length));
  return tied[idx].ex;
}

/** For short sessions with a single lower slot: train whichever lower plane is less recent. */
export function chooseLowerPattern(
  history: PlaneScores,
  sessionPicks: PlaneScores
): 'lower_squat' | 'lower_hinge' {
  const squat = history.squat + IN_SESSION_WEIGHT * sessionPicks.squat;
  const hinge = history.hinge + IN_SESSION_WEIGHT * sessionPicks.hinge;
  return squat <= hinge ? 'lower_squat' : 'lower_hinge';
}
