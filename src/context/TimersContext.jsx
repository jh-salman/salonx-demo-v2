import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

const STORAGE_KEY = '@salonx/timers/v1';

const TimersContext = createContext(null);

function loadInitialTimers() {
  if (typeof window === 'undefined') return {};
  try {
    const json = window.localStorage.getItem(STORAGE_KEY);
    if (!json) return {};
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch (err) {
    console.warn('[Timers] failed to load persisted state', err);
    return {};
  }
}

function persistTimers(timers) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
  } catch (err) {
    console.warn('[Timers] failed to persist state', err);
  }
}

/**
 * Timer state shape stored per key (clientName):
 *   - { kind: 'timerRunning', endsAt: ms }
 *   - { kind: 'stopwatchRunning', startedAt: ms }
 *   - { kind: 'completed' }
 */
export function TimersProvider({ children }) {
  const [timers, setTimers] = useState(loadInitialTimers);

  useEffect(() => {
    persistTimers(timers);
  }, [timers]);

  const setTimer = useCallback((key, value) => {
    if (!key) return;
    setTimers((prev) => {
      if (value == null) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const clearTimer = useCallback((key) => {
    setTimer(key, null);
  }, [setTimer]);

  const value = { timers, setTimer, clearTimer };
  return <TimersContext.Provider value={value}>{children}</TimersContext.Provider>;
}

export function useTimers() {
  const ctx = useContext(TimersContext);
  if (!ctx) {
    throw new Error('useTimers must be used inside a <TimersProvider>');
  }
  return ctx;
}

/** Convenience: read-only view of timers without mutators. */
export function useRunningTimers() {
  const ctx = useContext(TimersContext);
  return ctx?.timers || {};
}
