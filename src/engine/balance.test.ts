import { describe, expect, it } from 'vitest';
import { DEFAULT_EXERCISES } from '../data/defaultExercises';
import { DEFAULT_EQUIPMENT } from '../data/defaultInventory';
import { backfillExercise, mergeExercisesWithDefaults } from '../db/backfill';
import type { Exercise, PlannedExercise, WorkoutSession } from '../types/gym';
import { computePlaneRecency, resolvePlane } from './balance';
import { generateWorkoutSession, getSwapCandidates } from './workoutGenerator';

const exMap = new Map(DEFAULT_EXERCISES.map((e) => [e.id, e]));
const byId = (id: string) => exMap.get(id)!;
const rng0 = () => 0;
const rngHigh = () => 0.999;

function pe(exerciseId: string, opts: { sets?: number; done?: number; effort?: boolean } = {}): PlannedExercise {
  const sets = opts.sets ?? 3;
  const done = opts.done ?? sets;
  return {
    instanceId: `pe-${exerciseId}`,
    exerciseId,
    isFirstTime: false,
    effort: opts.effort ? 'just_right' : undefined,
    sets: Array.from({ length: sets }, (_, i) => ({
      setNumber: i + 1,
      targetWeight: 0,
      targetReps: 10,
      actualWeight: 0,
      actualReps: 10,
      completed: i < done,
    })),
  };
}

function session(id: string, completedAt: string | undefined, strength: PlannedExercise[]): WorkoutSession {
  return {
    id,
    gymId: 'building-gym',
    status: completedAt ? 'completed' : 'in_progress',
    createdAt: completedAt ?? '2026-11-25T00:00:00Z',
    completedAt,
    durationMin: 30,
    blocks: [{ type: 'strength', title: 'Strength', estimatedMinutes: 15, exercises: strength }],
  };
}

const strengthIds = (s: WorkoutSession) =>
  s.blocks.find((b) => b.type === 'strength')!.exercises.map((e) => e.exerciseId);
const strengthPlanes = (s: WorkoutSession) => strengthIds(s).map((id) => resolvePlane(byId(id)));

describe('computePlaneRecency', () => {
  it('weights most recent 2x, previous 1x, and ignores older sessions', () => {
    const s1 = session('s1', '2026-11-24T10:00:00Z', [pe('ex-machine-chest-press', { sets: 2 })]);
    const s2 = session('s2', '2026-11-22T10:00:00Z', [pe('ex-lat-pulldown', { sets: 2 })]);
    const s3 = session('s3', '2026-11-20T10:00:00Z', [pe('ex-db-rdl', { sets: 2 })]);
    const scores = computePlaneRecency([s3, s1, s2], exMap);
    expect(scores.horizontal_push).toBe(4);
    expect(scores.vertical_pull).toBe(2);
    expect(scores.hinge).toBe(0);
  });

  it('ignores incomplete sessions and sorts by completedAt regardless of input order', () => {
    const inProgress = session('ip', undefined, [pe('ex-leg-press')]);
    const older = session('old', '2026-11-20T10:00:00Z', [pe('ex-db-rdl', { sets: 1 })]);
    const newer = session('new', '2026-11-24T10:00:00Z', [pe('ex-db-goblet-squat', { sets: 1 })]);
    const scores = computePlaneRecency([older, inProgress, newer], exMap);
    expect(scores.squat).toBe(2);
    expect(scores.hinge).toBe(1);
  });

  it('counts only completed work; effort-only counts all sets; skipped counts 0', () => {
    const s = session('s', '2026-11-24T10:00:00Z', [
      pe('ex-machine-chest-press', { sets: 3, done: 0 }), // skipped
      pe('ex-lat-pulldown', { sets: 3, done: 0, effort: true }), // effort only
      pe('ex-leg-press', { sets: 3, done: 1 }), // partial
    ]);
    const scores = computePlaneRecency([s], exMap);
    expect(scores.horizontal_push).toBe(0);
    expect(scores.vertical_pull).toBe(6);
    expect(scores.squat).toBe(2);
  });

  it('ignores unknown or deleted exercise ids', () => {
    const s = session('s', '2026-11-24T10:00:00Z', [pe('ex-deleted')]);
    expect(() => computePlaneRecency([s], exMap)).not.toThrow();
  });
});

describe('resolvePlane', () => {
  it('prefers explicit tags, falls back by pattern, and is undefined for non-strength', () => {
    expect(resolvePlane(byId('ex-db-overhead-press'))).toBe('vertical_push');
    expect(resolvePlane({ pattern: 'upper_pull' })).toBe('horizontal_pull');
    expect(resolvePlane(byId('ex-dead-bug'))).toBeUndefined();
    expect(resolvePlane(byId('ex-treadmill-walk'))).toBeUndefined();
  });
});

describe('balanced strength selection', () => {
  it('20-min lower slot trains the plane that was hit less recently', () => {
    const squatHeavy = session('s', '2026-11-24T10:00:00Z', [pe('ex-leg-press'), pe('ex-db-goblet-squat')]);
    const s20a = generateWorkoutSession(20, DEFAULT_EQUIPMENT, DEFAULT_EXERCISES, [squatHeavy], {}, rng0);
    expect(strengthPlanes(s20a)[2]).toBe('hinge');

    const hingeHeavy = session('s', '2026-11-24T10:00:00Z', [pe('ex-db-rdl'), pe('ex-cable-pull-through')]);
    const s20b = generateWorkoutSession(20, DEFAULT_EQUIPMENT, DEFAULT_EXERCISES, [hingeHeavy], {}, rng0);
    expect(strengthPlanes(s20b)[2]).toBe('squat');

    const s20c = generateWorkoutSession(20, DEFAULT_EQUIPMENT, DEFAULT_EXERCISES, [], {}, rng0);
    expect(strengthPlanes(s20c)[2]).toBe('squat');
  });

  it('rotates push plane after a horizontal push, and avoids exact repeats when the plane is exhausted', () => {
    const lastHorizontal = session('s', '2026-11-24T10:00:00Z', [pe('ex-machine-chest-press')]);
    const next = generateWorkoutSession(30, DEFAULT_EQUIPMENT, DEFAULT_EXERCISES, [lastHorizontal], {}, rng0);
    expect(strengthIds(next)[0]).toBe('ex-db-overhead-press');

    const lastVertical = session('s', '2026-11-24T10:00:00Z', [pe('ex-db-overhead-press')]);
    const next2 = generateWorkoutSession(30, DEFAULT_EQUIPMENT, DEFAULT_EXERCISES, [lastVertical], {}, rng0);
    expect(strengthIds(next2)[0]).not.toBe('ex-db-overhead-press');
    expect(strengthPlanes(next2)[0]).toBe('horizontal_push');
  });

  it('60-min covers both push planes and both pull planes', () => {
    const fresh = generateWorkoutSession(60, DEFAULT_EQUIPMENT, DEFAULT_EXERCISES, [], {}, rng0);
    const planes = new Set(strengthPlanes(fresh));
    for (const p of ['horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull', 'squat', 'hinge']) {
      expect(planes.has(p as never)).toBe(true);
    }
  });

  it('still generates a full strength block when the only vertical push is unavailable', () => {
    const noDumbbells = DEFAULT_EQUIPMENT.map((e) => (e.id === 'eq-dumbbells' ? { ...e, isAvailable: false } : e));
    const s = generateWorkoutSession(60, noDumbbells, DEFAULT_EXERCISES, [], {}, rng0);
    const ids = strengthIds(s);
    expect(ids.every(Boolean)).toBe(true);
    expect(ids.length).toBeGreaterThanOrEqual(5);
  });

  it('is deterministic for a given rng; ties resolve to valid minimum choices', () => {
    const now = () => new Date('2026-11-25T12:00:00Z');
    const a = generateWorkoutSession(45, DEFAULT_EQUIPMENT, DEFAULT_EXERCISES, [], {}, rng0, now);
    const b = generateWorkoutSession(45, DEFAULT_EQUIPMENT, DEFAULT_EXERCISES, [], {}, rng0, now);
    expect(strengthIds(a)).toEqual(strengthIds(b));

    const c = generateWorkoutSession(45, DEFAULT_EQUIPMENT, DEFAULT_EXERCISES, [], {}, rngHigh, now);
    // Both rng values must still pick one exercise per push/pull/squat/hinge slot
    expect(strengthPlanes(c).map((p) => p?.split('_').pop())).toEqual(['push', 'pull', 'squat', 'hinge']);
  });
});

describe('getSwapCandidates balance ordering', () => {
  it('orders same-plane, non-recent candidates first when history is provided', () => {
    const current = generateWorkoutSession(30, DEFAULT_EQUIPMENT, DEFAULT_EXERCISES, [], {}, rng0);
    const pushEx = byId(strengthIds(current)[0]);
    const history = [session('h', '2026-11-24T10:00:00Z', [pe('ex-cable-chest-press')])];
    const ordered = getSwapCandidates(pushEx, 'strength', current, DEFAULT_EQUIPMENT, DEFAULT_EXERCISES, history);
    const plain = getSwapCandidates(pushEx, 'strength', current, DEFAULT_EQUIPMENT, DEFAULT_EXERCISES);

    expect(new Set(ordered.map((e) => e.id))).toEqual(new Set(plain.map((e) => e.id)));
    expect(resolvePlane(ordered[0])).toBe(resolvePlane(pushEx));
    expect(ordered[0].id).not.toBe('ex-cable-chest-press');
  });
});

describe('exercise backfill', () => {
  const defaultsById = new Map(DEFAULT_EXERCISES.map((d) => [d.id, d]));

  it('fills library planes, falls back for custom rows, and never overwrites tags', () => {
    const { plane: _p, ...untaggedOhp } = byId('ex-db-overhead-press');
    expect(backfillExercise(untaggedOhp as Exercise, defaultsById).plane).toBe('vertical_push');

    const custom: Exercise = { ...byId('ex-lat-pulldown'), id: 'ex-custom', plane: undefined };
    expect(backfillExercise(custom, defaultsById).plane).toBe('horizontal_pull');

    const tagged: Exercise = { ...byId('ex-seated-cable-row'), plane: 'vertical_pull' };
    expect(backfillExercise(tagged, defaultsById).plane).toBe('vertical_pull');
  });

  it('appends missing default exercises without replacing user rows', () => {
    const userRow: Exercise = { ...byId('ex-leg-press'), name: 'My Leg Press' };
    const { merged } = mergeExercisesWithDefaults([userRow], DEFAULT_EXERCISES);
    expect(merged.length).toBe(DEFAULT_EXERCISES.length);
    expect(merged.find((e) => e.id === 'ex-leg-press')!.name).toBe('My Leg Press');
  });
});
