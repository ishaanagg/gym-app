import type {
  Exercise,
  MovementPattern,
  MovementPlane,
  PlannedExercise,
  WorkoutSession,
} from '../types/gym';

/**
 * Pure session-balancing helpers. No storage or React imports so the engine stays
 * deterministic and unit-testable (rng is always injected by the caller).
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

/** Weight applied to planes already picked earlier in the same session (beats history). */
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
export function resolvePlane(ex: Pick<Exercise, 'plane' | 'pattern'> | undefined): MovementPlane | undefined {
  if (!ex) return undefined;
  return ex.plane ?? PATTERN_DEFAULT_PLANE[ex.pattern];
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
 *   2. Lowest plane score (history + IN_SESSION_WEIGHT × picks already in this session)
 *   3. rng tie-break among exact ties
 */
export function pickBalancedExercise(
  candidates: Exercise[],
  recentIds: Set<string>,
  history: PlaneScores,
  sessionPicks: PlaneScores,
  rng: () => number
): Exercise | undefined {
  if (candidates.length === 0) return undefined;

  const keyed = candidates.map((ex) => {
    const plane = resolvePlane(ex);
    const planeScore = plane ? history[plane] + IN_SESSION_WEIGHT * sessionPicks[plane] : 0;
    return { ex, repeat: recentIds.has(ex.id) ? 1 : 0, planeScore };
  });

  const minRepeat = Math.min(...keyed.map((k) => k.repeat));
  const tier1 = keyed.filter((k) => k.repeat === minRepeat);
  const minScore = Math.min(...tier1.map((k) => k.planeScore));
  const tied = tier1.filter((k) => k.planeScore === minScore);

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
