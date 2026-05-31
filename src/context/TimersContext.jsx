import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { fireTimerAlarm } from '../lib/timerAlarm';

const STORAGE_KEY = '@salonx/timers/v1';

const TimersContext = createContext(null);

function loadInitialTimers() {
  if (typeof window === 'undefined') return {};
  try {
    const json = window.localStorage.getItem(STORAGE_KEY);
    if (!json) return {};
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return {};
    const now = Date.now();
    const normalized = {};
    Object.entries(parsed).forEach(([key, t]) => {
      if (t?.kind === 'timerRunning' && typeof t.endsAt === 'number' && t.endsAt <= now) {
        normalized[key] = { kind: 'completed' };
      } else {
        normalized[key] = t;
      }
    });
    return normalized;
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
 * Timer state shape stored per key (calendar appointment id as string — must match
 * across Calendar chips, ClientList cards, and Screen2's `timerKey`).
 *   - { kind: 'timerRunning', endsAt: ms }
 *   - { kind: 'stopwatchRunning', startedAt: ms }
 *   - { kind: 'completed' }
 */
export function TimersProvider({ children }) {
  const [timers, setTimers] = useState(loadInitialTimers);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    persistTimers(timers);
  }, [timers]);

  useEffect(() => {
    const hasRunningCountdown = Object.values(timers).some(
      (t) => t?.kind === 'timerRunning',
    );
    if (!hasRunningCountdown) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
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
      const prevEntry = prev[key];
      if (value.kind === 'completed' && prevEntry?.kind === 'timerRunning') {
        fireTimerAlarm();
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const clearTimer = useCallback((key) => {
    setTimer(key, null);
  }, [setTimer]);

  // Promote expired countdowns from any screen (Calendar, Screen2, Stylist).
  useEffect(() => {
    Object.entries(timers).forEach(([key, t]) => {
      if (t?.kind === 'timerRunning' && typeof t.endsAt === 'number' && t.endsAt <= now) {
        setTimer(key, { kind: 'completed' });
      }
    });
  }, [timers, now, setTimer]);

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
