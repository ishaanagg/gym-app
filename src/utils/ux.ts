import { useEffect } from 'react';
import { getRecentCompletedSessions, resolvePlane } from '../engine/balance';
import type { Exercise, MovementPlane, WorkoutSession } from '../types/gym';

/** Subtle haptic pulse on devices that support Vibration API (safe no-op on iOS/desktop). */
export function triggerHaptic(ms: number | number[] = 10): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(ms);
    }
  } catch {
    // Ignore
  }
}

/** Keeps the phone display awake during an active workout session. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const wl = await navigator.wakeLock.request('screen');
        if (cancelled) {
          await wl.release();
          return;
        }
        sentinel = wl;
      } catch {
        // Ignore if battery saver or browser policy declines
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !cancelled) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (sentinel) {
        void sentinel.release();
      }
    };
  }, [active]);
}

export function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, Math.ceil(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const PLANE_SHORT_LABEL: Record<MovementPlane, string> = {
  horizontal_push: 'Chest Push',
  vertical_push: 'Overhead Push',
  horizontal_pull: 'Row Pull',
  vertical_pull: 'Vertical Pull',
  squat: 'Squat',
  hinge: 'Hinge',
};

/**
 * Generates a calm, human-readable 1-line explanation of today's strength movement planes
 * so the user can see how the session complements their recent workouts.
 */
export function describeSessionFocus(
  session: WorkoutSession,
  exercises: Exercise[],
  recentSessions: WorkoutSession[]
): string {
  const strengthBlock = session.blocks.find((b) => b.type === 'strength');
  if (!strengthBlock || strengthBlock.exercises.length === 0) {
    return 'Mobility, cardio, and recovery flow.';
  }

  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const labels: string[] = [];
  for (const pe of strengthBlock.exercises) {
    const plane = resolvePlane(exMap.get(pe.exerciseId));
    if (plane) {
      const label = PLANE_SHORT_LABEL[plane];
      if (!labels.includes(label)) labels.push(label);
    }
  }

  const focusList = labels.slice(0, 3).join(' · ');
  const recentCount = getRecentCompletedSessions(recentSessions, 2).length;

  if (recentCount === 0) {
    return `${focusList} — balanced full-body baseline.`;
  }
  return `${focusList} — complements your last ${recentCount === 1 ? 'workout' : '2 workouts'}.`;
}
