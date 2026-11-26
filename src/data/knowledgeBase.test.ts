import { describe, expect, it } from 'vitest';
import { generateWorkoutSession } from '../engine/workoutGenerator';
import type { Equipment } from '../types/gym';
import { DEFAULT_EXERCISES } from './defaultExercises';
import { DEFAULT_EQUIPMENT, DEFAULT_GYM_ID } from './defaultInventory';
import { buildExercisesForEquipment, inferArchetypeFromName } from './knowledgeBase';

const rng0 = () => 0;
const fixedNow = () => new Date('2026-11-26T12:00:00Z');

describe('offline equipment knowledge base & adaptive resilience', () => {
  it('recognizes common brand/machine names offline via fuzzy archetype matching', () => {
    expect(inferArchetypeFromName('LifeFitness Leg Curl')?.id).toBe('leg_curl');
    expect(inferArchetypeFromName('Concept2 Rower')?.id).toBe('rowing_machine');
    expect(inferArchetypeFromName('TRX Straps')?.id).toBe('trx_suspension');
    expect(inferArchetypeFromName('Cast Iron Kettlebells')?.id).toBe('kettlebell');
    expect(inferArchetypeFromName('Technogym Shoulder Press')?.id).toBe('shoulder_press_machine');
  });

  it('auto-seeds coach-cued exercises when a user adds new equipment and integrates into workouts', () => {
    const newShoulderMachine: Equipment = {
      id: 'eq-custom-shoulder',
      gymId: DEFAULT_GYM_ID,
      name: 'Technogym Shoulder Press',
      category: 'machine',
      weightUnit: 'lbs',
      weightOptions: [20, 40, 60, 80, 100],
      isAvailable: true,
    };

    const autoExercises = buildExercisesForEquipment(newShoulderMachine, DEFAULT_EXERCISES);
    expect(autoExercises.length).toBeGreaterThanOrEqual(1);
    expect(autoExercises[0].name).toBe('Machine Shoulder Press');

    // Disable dumbbells so the newly added Shoulder Press Machine is the vertical push option
    const customGym = [
      ...DEFAULT_EQUIPMENT.map((e) =>
        e.id === 'eq-dumbbells' ? { ...e, isAvailable: false } : e
      ),
      newShoulderMachine,
    ];
    const allExercises = [...DEFAULT_EXERCISES, ...autoExercises];

    const session = generateWorkoutSession(
      30,
      customGym,
      allExercises,
      [],
      {},
      rng0,
      fixedNow,
      { targets: ['shoulders'], intensity: 'medium' }
    );

    const strengthIds = session.blocks
      .find((b) => b.type === 'strength')!
      .exercises.map((e) => e.exerciseId);
    expect(strengthIds).toContain(autoExercises[0].id);
  });

  it('adapts gracefully to a zero-machine / bodyweight-only environment without losing any of the 5 blocks', () => {
    // User removed every single machine and weight from My Gym
    const emptyGym: Equipment[] = [];
    const session = generateWorkoutSession(30, emptyGym, DEFAULT_EXERCISES, [], {}, rng0, fixedNow);

    expect(session.blocks.map((b) => b.type)).toEqual([
      'warmup',
      'strength',
      'core',
      'cardio',
      'stretch',
    ]);

    const strength = session.blocks.find((b) => b.type === 'strength')!;
    expect(strength.exercises.length).toBe(4);

    const cardio = session.blocks.find((b) => b.type === 'cardio')!;
    expect(cardio.exercises[0].exerciseId).toBe('ex-bw-athletic-conditioning');
  });

  it('matches warm-up priming and post-workout stretches to the muscles trained today', () => {
    const chestDay = generateWorkoutSession(
      20,
      DEFAULT_EQUIPMENT,
      DEFAULT_EXERCISES,
      [],
      {},
      rng0,
      fixedNow,
      { targets: ['chest'], intensity: 'medium' }
    );

    const chestWarmupId = chestDay.blocks.find((b) => b.type === 'warmup')!.exercises[0].exerciseId;
    const chestStretchId = chestDay.blocks.find((b) => b.type === 'stretch')!.exercises[0].exerciseId;
    expect(['ex-cat-cow-thoracic', 'ex-scapular-wall-slides']).toContain(chestWarmupId);
    expect(chestStretchId).toBe('ex-chest-pec-opener');

    const legDay = generateWorkoutSession(
      20,
      DEFAULT_EQUIPMENT,
      DEFAULT_EXERCISES,
      [],
      {},
      rng0,
      fixedNow,
      { targets: ['legs'], intensity: 'medium' }
    );
    const legWarmupId = legDay.blocks.find((b) => b.type === 'warmup')!.exercises[0].exerciseId;
    const legStretchId = legDay.blocks.find((b) => b.type === 'stretch')!.exercises[0].exerciseId;
    expect(['ex-worlds-greatest', 'ex-squat-to-stand']).toContain(legWarmupId);
    expect(['ex-hip-flexor-stretch', 'ex-figure-four-stretch']).toContain(legStretchId);
  });
});
