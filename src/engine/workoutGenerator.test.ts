import { describe, expect, it } from 'vitest';
import { DEFAULT_EXERCISES } from '../data/defaultExercises';
import { DEFAULT_EQUIPMENT, DEFAULT_GYM_ID } from '../data/defaultInventory';
import type { ExerciseProgress, WorkoutSession } from '../types/gym';
import {
  generateWorkoutSession,
  getInitialWeight,
  getNextTarget,
  snapToAvailableWeight,
} from './workoutGenerator';

describe('workoutGenerator', () => {
  const chestPressEq = DEFAULT_EQUIPMENT.find((e) => e.id === 'eq-chest-press')!;
  const chestPressEx = DEFAULT_EXERCISES.find((e) => e.id === 'ex-machine-chest-press')!;
  const fixedRng = () => 0;

  it('picks a conservative ~25% starting weight from exact weightOptions', () => {
    // [15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165] -> floor(10 * 0.25) = idx 2 -> 45
    expect(getInitialWeight(chestPressEq)).toBe(45);
    const matEq = DEFAULT_EQUIPMENT.find((e) => e.id === 'eq-mat')!;
    expect(getInitialWeight(matEq)).toBe(0);
  });

  it('snaps arbitrary weights to the closest available plate', () => {
    expect(snapToAvailableWeight(52, chestPressEq)).toBe(45);
    expect(snapToAvailableWeight(53, chestPressEq)).toBe(60);
  });

  it('applies exact-plate double progression across Easy, Just Right, and Too Hard', () => {
    // First time
    const first = getNextTarget(chestPressEx, chestPressEq, undefined);
    expect(first).toEqual({ weight: 45, reps: 8, isFirstTime: true });

    // Easy at top of rep range (12) -> advance from 45 to 60 at 8 reps
    const easyTop: ExerciseProgress = {
      exerciseId: chestPressEx.id,
      currentWeight: 45,
      lastReps: 12,
      lastEffort: 'easy',
      isCalibrated: false,
      source: 'logged',
      totalSessions: 2,
      updatedAt: '2026-11-25T00:00:00Z',
    };
    expect(getNextTarget(chestPressEx, chestPressEq, easyTop)).toEqual({
      weight: 60,
      reps: 8,
      isFirstTime: false,
    });

    // Just Right -> hold 60, aim for +1 rep
    const justRight: ExerciseProgress = {
      ...easyTop,
      currentWeight: 60,
      lastReps: 9,
      lastEffort: 'just_right',
    };
    expect(getNextTarget(chestPressEx, chestPressEq, justRight)).toEqual({
      weight: 60,
      reps: 10,
      isFirstTime: false,
    });

    // Too Hard at bottom of rep range (8) -> step down from 60 to 45
    const tooHard: ExerciseProgress = {
      ...easyTop,
      currentWeight: 60,
      lastReps: 8,
      lastEffort: 'too_hard',
    };
    expect(getNextTarget(chestPressEx, chestPressEq, tooHard)).toEqual({
      weight: 45,
      reps: 8,
      isFirstTime: false,
    });
  });

  it('scales all 5 holistic blocks cleanly by session duration', () => {
    const s20 = generateWorkoutSession(20, DEFAULT_EQUIPMENT, DEFAULT_EXERCISES, [], {}, fixedRng);
    const s60 = generateWorkoutSession(60, DEFAULT_EQUIPMENT, DEFAULT_EXERCISES, [], {}, fixedRng);

    expect(s20.blocks.map((b) => b.type)).toEqual(['warmup', 'strength', 'core', 'cardio', 'stretch']);
    expect(s60.blocks.map((b) => b.type)).toEqual(['warmup', 'strength', 'core', 'cardio', 'stretch']);

    const s20Strength = s20.blocks.find((b) => b.type === 'strength')!;
    const s60Strength = s60.blocks.find((b) => b.type === 'strength')!;
    expect(s20Strength.exercises.length).toBe(3);
    expect(s20Strength.exercises[0].sets.length).toBe(2);
    expect(s60Strength.exercises.length).toBe(6);
    expect(s60Strength.exercises[0].sets.length).toBe(3);
  });

  it('rotates away from recently completed exercises ("do something else today")', () => {
    const firstSession = generateWorkoutSession(
      30,
      DEFAULT_EQUIPMENT,
      DEFAULT_EXERCISES,
      [],
      {},
      fixedRng
    );
    const completedFirst: WorkoutSession = {
      ...firstSession,
      status: 'completed',
      completedAt: '2026-11-24T10:00:00Z',
    };

    const secondSession = generateWorkoutSession(
      30,
      DEFAULT_EQUIPMENT,
      DEFAULT_EXERCISES,
      [completedFirst],
      {},
      fixedRng
    );

    const firstStrengthIds = new Set(
      firstSession.blocks.find((b) => b.type === 'strength')!.exercises.map((e) => e.exerciseId)
    );
    const secondStrengthIds = secondSession.blocks
      .find((b) => b.type === 'strength')!
      .exercises.map((e) => e.exerciseId);

    // Every strength exercise in session 2 should be different from session 1 when alternatives exist
    for (const id of secondStrengthIds) {
      expect(firstStrengthIds.has(id)).toBe(false);
    }
  });

  it('excludes exercises whose equipment is toggled unavailable', () => {
    const updatedEq = DEFAULT_EQUIPMENT.map((e) =>
      e.id === 'eq-leg-press' ? { ...e, gymId: DEFAULT_GYM_ID, isAvailable: false } : e
    );
    const session = generateWorkoutSession(45, updatedEq, DEFAULT_EXERCISES, [], {}, fixedRng);
    const allIds = session.blocks.flatMap((b) => b.exercises.map((e) => e.exerciseId));
    expect(allIds).not.toContain('ex-leg-press');
  });
});
