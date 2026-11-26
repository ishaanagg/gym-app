import { describe, expect, it } from 'vitest';
import { DEFAULT_EXERCISES } from '../data/defaultExercises';
import { DEFAULT_EQUIPMENT } from '../data/defaultInventory';
import { generateWorkoutSession } from '../engine/workoutGenerator';
import { describeSessionFocus, formatClock } from './ux';

describe('ux helpers', () => {
  it('formats countdown seconds as M:SS cleanly', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(45)).toBe('0:45');
    expect(formatClock(60)).toBe('1:00');
    expect(formatClock(300)).toBe('5:00');
  });

  it('describes session focus for fresh baseline vs complementary history', () => {
    const rng = () => 0;
    const fresh = generateWorkoutSession(30, DEFAULT_EQUIPMENT, DEFAULT_EXERCISES, [], {}, rng);
    expect(describeSessionFocus(fresh, DEFAULT_EXERCISES, [])).toContain('baseline');

    const completed = {
      ...fresh,
      status: 'completed' as const,
      completedAt: '2026-11-25T12:00:00Z',
    };
    expect(describeSessionFocus(fresh, DEFAULT_EXERCISES, [completed])).toContain(
      'complements your last workout'
    );
  });
});
