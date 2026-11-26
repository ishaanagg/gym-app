import { describe, expect, it } from 'vitest';
import { DEFAULT_EXERCISES } from '../data/defaultExercises';
import { DEFAULT_EQUIPMENT } from '../data/defaultInventory';
import type { ExerciseProgress } from '../types/gym';
import { resolveTargetAreas } from './balance';
import { generateWorkoutSession } from './workoutGenerator';

const exMap = new Map(DEFAULT_EXERCISES.map((e) => [e.id, e]));
const rng0 = () => 0;
const fixedNow = () => new Date('2026-11-26T12:00:00Z');

describe('offline macro focus & intensity algorithm', () => {
  it('selects dedicated arm exercises alternating biceps and triceps when Arms is chosen', () => {
    const session = generateWorkoutSession(
      30,
      DEFAULT_EQUIPMENT,
      DEFAULT_EXERCISES,
      [],
      {},
      rng0,
      fixedNow,
      { targets: ['arms'], intensity: 'medium' }
    );

    const strength = session.blocks.find((b) => b.type === 'strength')!;
    expect(strength.exercises.length).toBe(4);

    const muscles = strength.exercises.map((pe) => exMap.get(pe.exerciseId)!.primaryMuscles?.[0]);
    expect(muscles).toContain('biceps');
    expect(muscles).toContain('triceps');
    for (const pe of strength.exercises) {
      const areas = resolveTargetAreas(exMap.get(pe.exerciseId)!);
      expect(areas.primary).toContain('arms');
    }
  });

  it('focuses exclusively on lower-body squat & hinge movements when Legs is chosen', () => {
    const session = generateWorkoutSession(
      45,
      DEFAULT_EQUIPMENT,
      DEFAULT_EXERCISES,
      [],
      {},
      rng0,
      fixedNow,
      { targets: ['legs'], intensity: 'medium' }
    );

    const strength = session.blocks.find((b) => b.type === 'strength')!;
    expect(strength.exercises.length).toBe(4);
    for (const pe of strength.exercises) {
      const ex = exMap.get(pe.exerciseId)!;
      expect(resolveTargetAreas(ex).primary).toContain('legs');
    }
  });

  it('splits slots round-robin across multiple chosen macros (e.g., Chest + Back + Abs)', () => {
    const session = generateWorkoutSession(
      45,
      DEFAULT_EQUIPMENT,
      DEFAULT_EXERCISES,
      [],
      {},
      rng0,
      fixedNow,
      { targets: ['chest', 'back', 'abs'], intensity: 'medium' }
    );

    const strength = session.blocks.find((b) => b.type === 'strength')!;
    const primaryAreas = strength.exercises.flatMap(
      (pe) => resolveTargetAreas(exMap.get(pe.exerciseId)!).primary
    );
    expect(primaryAreas).toContain('chest');
    expect(primaryAreas).toContain('back');

    const core = session.blocks.find((b) => b.type === 'core')!;
    expect(core.exercises.length).toBeGreaterThanOrEqual(3);
  });

  it('expands the Core block when Abs-only is selected while keeping posture support', () => {
    const session = generateWorkoutSession(
      30,
      DEFAULT_EQUIPMENT,
      DEFAULT_EXERCISES,
      [],
      {},
      rng0,
      fixedNow,
      { targets: ['abs'], intensity: 'medium' }
    );

    const core = session.blocks.find((b) => b.type === 'core')!;
    expect(core.exercises.length).toBe(3);
  });

  it('scales weight, reps, sets, and cardio accurately across Light, Medium, and Hard intensities', () => {
    const progress: Record<string, ExerciseProgress> = {
      'ex-machine-chest-press': {
        exerciseId: 'ex-machine-chest-press',
        currentWeight: 60, // plates: 15, 30, 45, 60, 75...
        lastReps: 10,
        lastEffort: 'just_right',
        isCalibrated: false,
        source: 'logged',
        totalSessions: 3,
        updatedAt: '2026-11-25T12:00:00Z',
      },
    };

    const light = generateWorkoutSession(
      45,
      DEFAULT_EQUIPMENT,
      DEFAULT_EXERCISES,
      [],
      progress,
      rng0,
      fixedNow,
      { targets: ['chest'], intensity: 'light' }
    );
    const medium = generateWorkoutSession(
      45,
      DEFAULT_EQUIPMENT,
      DEFAULT_EXERCISES,
      [],
      progress,
      rng0,
      fixedNow,
      { targets: ['chest'], intensity: 'medium' }
    );
    const hard = generateWorkoutSession(
      45,
      DEFAULT_EQUIPMENT,
      DEFAULT_EXERCISES,
      [],
      progress,
      rng0,
      fixedNow,
      { targets: ['chest'], intensity: 'hard' }
    );

    const getChest = (s: typeof light) =>
      s.blocks
        .find((b) => b.type === 'strength')!
        .exercises.find((e) => e.exerciseId === 'ex-machine-chest-press')!;

    // Light: steps down 1 plate (60 -> 45 lbs), 2 sets, minReps (8)
    expect(getChest(light).sets.length).toBe(2);
    expect(getChest(light).sets[0].targetWeight).toBe(45);
    expect(getChest(light).sets[0].targetReps).toBe(8);

    // Medium: normal double progression (60 lbs, 11 reps, 3 sets)
    expect(getChest(medium).sets.length).toBe(3);
    expect(getChest(medium).sets[0].targetWeight).toBe(60);
    expect(getChest(medium).sets[0].targetReps).toBe(11);

    // Hard: working weight (60 lbs), pushed to top of repRange (12 reps), 4 sets, +cardio
    expect(getChest(hard).sets.length).toBe(4);
    expect(getChest(hard).sets[0].targetWeight).toBe(60);
    expect(getChest(hard).sets[0].targetReps).toBe(12);

    const lightCardio = light.blocks.find((b) => b.type === 'cardio')!.estimatedMinutes;
    const hardCardio = hard.blocks.find((b) => b.type === 'cardio')!.estimatedMinutes;
    expect(hardCardio).toBeGreaterThan(lightCardio);
  });
});
