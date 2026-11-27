import { describe, expect, it } from 'vitest';
import { DEFAULT_EXERCISES } from '../data/defaultExercises';
import { DEFAULT_EQUIPMENT } from '../data/defaultInventory';
import type {
  EffortRating,
  ExerciseProgress,
  SessionDuration,
  SessionIntensity,
  TargetArea,
  WorkoutSession,
} from '../types/gym';
import { computeUpdatedProgress, generateWorkoutSession } from './workoutGenerator';

/** Deterministic Mulberry32 PRNG so fuzz failures are 100% reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('250-session multi-week fuzz & invariant simulation', () => {
  it('maintains valid blocks, exact machine plates, zero duplicates, and finite targets across 250 randomized workouts', () => {
    const rng = mulberry32(20261126);
    const durations: SessionDuration[] = [20, 30, 45, 60];
    const intensities: SessionIntensity[] = ['light', 'medium', 'hard'];
    const allTargets: TargetArea[] = ['legs', 'chest', 'back', 'shoulders', 'arms', 'abs'];
    const efforts: EffortRating[] = ['easy', 'just_right', 'too_hard'];

    const exMap = new Map(DEFAULT_EXERCISES.map((e) => [e.id, e]));
    const progress: Record<string, ExerciseProgress> = {};
    const history: WorkoutSession[] = [];

    for (let day = 0; day < 250; day++) {
      const duration = durations[Math.floor(rng() * durations.length)];
      const intensity = intensities[Math.floor(rng() * intensities.length)];

      // Randomly pick 0 (Balanced), 1, 2, or 3 macro target areas
      const targetCount = Math.floor(rng() * 4);
      const targets: TargetArea[] = [];
      for (let i = 0; i < targetCount; i++) {
        const pick = allTargets[Math.floor(rng() * allTargets.length)];
        if (!targets.includes(pick)) targets.push(pick);
      }

      // Randomly toggle equipment availability (including occasional 0-machine hotel days)
      const hotelDay = day % 25 === 24;
      const equipment = hotelDay
        ? []
        : DEFAULT_EQUIPMENT.map((eq) => ({
            ...eq,
            isAvailable: rng() > 0.2,
          }));
      const eqMap = new Map(equipment.map((e) => [e.id, e]));

      const simDate = new Date(Date.UTC(2026, 0, 1 + day, 12, 0, 0));
      const session = generateWorkoutSession(
        duration,
        equipment,
        DEFAULT_EXERCISES,
        history,
        progress,
        rng,
        () => simDate,
        { targets, intensity }
      );

      // Invariant 1: All 5 holistic blocks exist in exact canonical sequence
      expect(session.blocks.map((b) => b.type)).toEqual([
        'warmup',
        'strength',
        'core',
        'cardio',
        'stretch',
      ]);

      // Invariant 2: Zero duplicate exerciseIds within a single session
      const seenIds = new Set<string>();
      for (const block of session.blocks) {
        expect(block.exercises.length).toBeGreaterThan(0);
        expect(Number.isFinite(block.estimatedMinutes)).toBe(true);
        expect(block.estimatedMinutes).toBeGreaterThan(0);

        for (const pe of block.exercises) {
          expect(seenIds.has(pe.exerciseId)).toBe(false);
          seenIds.add(pe.exerciseId);

          const ex = exMap.get(pe.exerciseId)!;
          expect(ex).toBeDefined();
          const eq = eqMap.get(ex.equipmentId);

          // Invariant 3: Every set has finite positive reps and valid plate-snapped weight
          expect(pe.sets.length).toBeGreaterThan(0);
          for (const s of pe.sets) {
            expect(Number.isFinite(s.targetWeight)).toBe(true);
            expect(s.targetWeight).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(s.targetReps)).toBe(true);
            expect(s.targetReps).toBeGreaterThanOrEqual(1);

            if (eq && eq.weightOptions.length > 0) {
              expect(eq.weightOptions).toContain(s.targetWeight);
            } else {
              expect(s.targetWeight).toBe(0);
            }
          }
        }
      }

      // Simulate completing the workout and updating progression
      const completedBlocks = session.blocks.map((b) => ({
        ...b,
        exercises: b.exercises.map((pe) => {
          const effort = efforts[Math.floor(rng() * efforts.length)];
          const donePe = {
            ...pe,
            effort,
            sets: pe.sets.map((s) => ({ ...s, completed: true })),
          };
          if (b.type === 'strength' || b.type === 'core') {
            const nextProg = computeUpdatedProgress(donePe, effort);
            const prevProg = progress[pe.exerciseId];
            if (intensity === 'light' && prevProg && prevProg.currentWeight > nextProg.currentWeight) {
              nextProg.currentWeight = prevProg.currentWeight;
              nextProg.lastReps = prevProg.lastReps;
            }
            progress[pe.exerciseId] = nextProg;
          }
          return donePe;
        }),
      }));

      history.unshift({
        ...session,
        status: 'completed',
        completedAt: simDate.toISOString(),
        blocks: completedBlocks,
      });
    }
  });
});
