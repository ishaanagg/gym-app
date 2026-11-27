import { useEffect, useRef } from 'react';

export type BackPriority = 'tab' | 'screen' | 'modal';

const PRIORITY_WEIGHT: Record<BackPriority, number> = {
  tab: 10,
  screen: 20,
  modal: 30,
};

interface BackGuardEntry {
  id: symbol;
  priority: number;
  allowEscape: boolean;
  onBackRef: { current: () => void };
}

export interface BackGuardOptions {
  priority?: BackPriority;
  allowEscape?: boolean;
}

const SENTINEL_KEY = '__kineticGuard';

let guards: BackGuardEntry[] = [];
let listenersAttached = false;
let cleanupTimer: number | null = null;
let rearmTimer: number | null = null;
let ignoringPopCount = 0;

function hasHistorySentinel(): boolean {
  if (typeof window === 'undefined') return false;
  const state = window.history.state as Record<string, unknown> | null;
  return Boolean(state && state[SENTINEL_KEY] === true);
}

function pushHistorySentinel(): void {
  if (typeof window === 'undefined' || hasHistorySentinel()) return;
  const existing =
    window.history.state && typeof window.history.state === 'object'
      ? (window.history.state as Record<string, unknown>)
      : {};
  window.history.pushState({ ...existing, [SENTINEL_KEY]: true }, '');
}

function pickTopGuard(escapeOnly = false): BackGuardEntry | undefined {
  let chosen: BackGuardEntry | undefined;
  for (const entry of guards) {
    if (escapeOnly && !entry.allowEscape) continue;
    if (!chosen || entry.priority >= chosen.priority) {
      chosen = entry;
    }
  }
  return chosen;
}

function syncHistoryState(): void {
  if (typeof window === 'undefined') return;

  if (cleanupTimer !== null) {
    window.clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }

  if (guards.length > 0) {
    pushHistorySentinel();
    return;
  }

  // All guards closed via in-app UI controls: pop our single sentinel so 1 Back swipe exits from Today.
  if (hasHistorySentinel()) {
    cleanupTimer = window.setTimeout(() => {
      cleanupTimer = null;
      if (guards.length === 0 && hasHistorySentinel()) {
        ignoringPopCount += 1;
        window.history.back();
      }
    }, 0);
  }
}

function handlePopState(): void {
  if (ignoringPopCount > 0) {
    ignoringPopCount -= 1;
    if (guards.length > 0) {
      pushHistorySentinel();
    }
    return;
  }

  const top = pickTopGuard(false);
  if (!top) return;

  top.onBackRef.current();

  // Fallback re-arm if the invoked handler kept the same guard mounted without changing active count
  if (typeof window !== 'undefined') {
    if (rearmTimer !== null) window.clearTimeout(rearmTimer);
    rearmTimer = window.setTimeout(() => {
      rearmTimer = null;
      if (guards.length > 0 && !hasHistorySentinel()) {
        pushHistorySentinel();
      }
    }, 25);
  }
}

function handleKeyDown(e: KeyboardEvent): void {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  const top = pickTopGuard(true);
  if (!top) return;
  e.preventDefault();
  top.onBackRef.current();
}

function ensureListeners(): void {
  if (listenersAttached || typeof window === 'undefined') return;
  window.addEventListener('popstate', handlePopState);
  window.addEventListener('keydown', handleKeyDown);
  listenersAttached = true;
}

/**
 * Intercepts Android system Back gesture / iOS browser edge-swipe (`popstate`)
 * and `Escape` key in deterministic priority order (`modal` > `screen` > `tab`).
 */
export function useBackGuard(
  active: boolean,
  onBack: () => void,
  options?: BackGuardOptions
): void {
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });

  const priorityName = options?.priority ?? 'modal';
  const priority = PRIORITY_WEIGHT[priorityName];
  const allowEscape = options?.allowEscape ?? priorityName !== 'tab';

  useEffect(() => {
    if (!active) return;
    ensureListeners();

    const id = Symbol('kinetic-back-guard');
    const entry: BackGuardEntry = {
      id,
      priority,
      allowEscape,
      onBackRef,
    };
    guards.push(entry);
    syncHistoryState();

    return () => {
      guards = guards.filter((g) => g.id !== id);
      syncHistoryState();
    };
  }, [active, priority, allowEscape]);
}

export function resetBackNavigationForTests(): void {
  if (typeof window !== 'undefined') {
    if (cleanupTimer !== null) window.clearTimeout(cleanupTimer);
    if (rearmTimer !== null) window.clearTimeout(rearmTimer);
  }
  cleanupTimer = null;
  rearmTimer = null;
  guards = [];
  ignoringPopCount = 0;
  if (typeof window !== 'undefined' && hasHistorySentinel()) {
    window.history.replaceState({}, '');
  }
}
