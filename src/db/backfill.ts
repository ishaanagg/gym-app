import { resolvePlane } from '../engine/balance';
import type { Exercise } from '../types/gym';

/**
 * Pure, idempotent backfill for persisted exercise rows (no IndexedDB imports, unit-testable).
 * - Existing explicit tags are never overwritten.
 * - Default-library rows inherit the library's plane and primaryMuscles tags.
 * - Custom rows fall back to the pattern-derived plane.
 */
export function backfillExercise(row: Exercise, defaultsById: Map<string, Exercise>): Exercise {
  const def = defaultsById.get(row.id);
  const nextPlane = row.plane ?? def?.plane ?? resolvePlane(row);
  const nextMuscles =
    row.primaryMuscles && row.primaryMuscles.length > 0 ? row.primaryMuscles : def?.primaryMuscles;

  const planeChanged = nextPlane !== row.plane && nextPlane !== undefined;
  const musclesChanged = nextMuscles !== row.primaryMuscles && nextMuscles !== undefined;

  if (!planeChanged && !musclesChanged) return row;

  return {
    ...row,
    ...(nextPlane ? { plane: nextPlane } : {}),
    ...(nextMuscles ? { primaryMuscles: nextMuscles } : {}),
  };
}

/**
 * Backfills stored rows and appends any default exercises whose ids are not stored yet,
 * so future library additions reach existing installs. User rows are never replaced.
 */
export function mergeExercisesWithDefaults(
  stored: Exercise[],
  defaults: Exercise[]
): { merged: Exercise[]; changed: Exercise[] } {
  const defaultsById = new Map(defaults.map((d) => [d.id, d]));
  const storedIds = new Set(stored.map((s) => s.id));
  const changed: Exercise[] = [];

  const merged = stored.map((row) => {
    const next = backfillExercise(row, defaultsById);
    if (next !== row) changed.push(next);
    return next;
  });

  for (const d of defaults) {
    if (!storedIds.has(d.id)) {
      merged.push(d);
      changed.push(d);
    }
  }

  return { merged, changed };
}
