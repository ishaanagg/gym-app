import { resolvePlane } from '../engine/balance';
import type { Exercise } from '../types/gym';

/**
 * Pure, idempotent backfill for persisted exercise rows (no IndexedDB imports, unit-testable).
 * - Existing explicit tags are never overwritten.
 * - Default-library rows inherit the library's plane tag.
 * - Custom rows fall back to the pattern-derived plane.
 */
export function backfillExercise(row: Exercise, defaultsById: Map<string, Exercise>): Exercise {
  if (row.plane) return row;
  const plane = defaultsById.get(row.id)?.plane ?? resolvePlane(row);
  return plane ? { ...row, plane } : row;
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
