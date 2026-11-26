import { useEffect } from 'react';
import { getRecentCompletedSessions, resolvePlane } from '../engine/balance';
import type {
  Exercise,
  MovementPlane,
  SessionIntensity,
  TargetArea,
  WorkoutSession,
} from '../types/gym';

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

export const TARGET_AREA_LABELS: Record<TargetArea, string> = {
  legs: 'Legs',
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  abs: 'Abs',
};

const INTENSITY_DESC: Record<SessionIntensity, string> = {
  light: 'Light restorative pace',
  medium: 'Steady working effort',
  hard: 'High-volume push',
};

/**
 * Generates a calm, human-readable 1-line explanation of today's session plan.
 */
export function describeSessionFocus(
  session: WorkoutSession,
  exercises: Exercise[],
  recentSessions: WorkoutSession[]
): string {
  const targets = session.targets ?? [];
  const intensity = session.intensity ?? 'medium';

  if (targets.length > 0) {
    const areaNames = targets.map((t) => TARGET_AREA_LABELS[t]).join(' + ');
    return `${areaNames} · ${INTENSITY_DESC[intensity]}.`;
  }

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
  const paceSuffix = intensity !== 'medium' ? ` (${intensity})` : '';

  if (recentCount === 0) {
    return `${focusList}${paceSuffix} — balanced full-body baseline.`;
  }
  return `${focusList}${paceSuffix} — complements your last ${
    recentCount === 1 ? 'workout' : '2 workouts'
  }.`;
}
