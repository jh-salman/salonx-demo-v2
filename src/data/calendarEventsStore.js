// Shared reader/subscriber for the Calendar screen's persisted events.
// Calendar.jsx is the single writer (localStorage key "@salonx/calendar/v1").
// Other screens (Stylist/ClientList, etc.) read via `useCalendarEvents()` and
// react to in-tab updates through the `salonx:calendar-updated` CustomEvent.
//
// When v2-admin appointments API is active (`getV2AdminBase()`), Calendar mirrors
// live `events` here so hooks still work without persisting events to localStorage.

import { useEffect, useState } from 'react';
import { readApiAppointmentsSessionCache, writeApiAppointmentsSessionCache } from './apiAppointmentsSessionCache.js';
import { getV2AdminBase } from '../sync/v2AdminBootstrap.js';
import {
  appointmentDtoToEvent,
  fetchAppointmentsRange,
  isAppointmentsApiAvailable,
} from './v2AppointmentsApi.js';

const CALENDAR_STORAGE_KEY = '@salonx/calendar/v1';
const UPDATE_EVENT_NAME = 'salonx:calendar-updated';

/** @type {unknown[] | null} */
let apiModeEventsMirror = null;

/** @param {unknown[] | null} events */
export function setApiModeCalendarEventsMirror(events) {
  apiModeEventsMirror = events;
}

function reviveDate(value) {
  if (value && typeof value === 'object' && value.__type === 'Date') {
    return new Date(value.value);
  }
  return value;
}

function deserialize(json) {
  return JSON.parse(json, (_k, v) => reviveDate(v));
}

function ensureDate(v) {
  if (v == null) return v;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function readCalendarRoot() {
  if (typeof window === 'undefined') return null;
  try {
    const json = window.localStorage.getItem(CALENDAR_STORAGE_KEY);
    if (!json) return null;
    return deserialize(json);
  } catch (err) {
    console.warn('[calendarEventsStore] load failed', err);
    return null;
  }
}

export function loadCalendarEvents() {
  if (getV2AdminBase()) {
    const mirrored = Array.isArray(apiModeEventsMirror) ? apiModeEventsMirror : null
    if (mirrored && mirrored.length > 0) {
      return mirrored
        .map((ev) => ({
          ...ev,
          start: ensureDate(ev.start),
          end: ensureDate(ev.end),
        }))
        .filter((ev) => ev.start instanceof Date && ev.end instanceof Date)
    }
    const cached = readApiAppointmentsSessionCache()
    if (cached && cached.length > 0) {
      return cached
        .map((ev) => ({
          ...ev,
          start: ensureDate(ev.start),
          end: ensureDate(ev.end),
        }))
        .filter((ev) => ev.start instanceof Date && ev.end instanceof Date)
    }
    if (mirrored) {
      return mirrored
        .map((ev) => ({
          ...ev,
          start: ensureDate(ev.start),
          end: ensureDate(ev.end),
        }))
        .filter((ev) => ev.start instanceof Date && ev.end instanceof Date)
    }
    return []
  }
  const data = readCalendarRoot();
  const events = Array.isArray(data?.events) ? data.events : [];
  return events
    .map((ev) => ({
      ...ev,
      start: ensureDate(ev.start),
      end: ensureDate(ev.end),
    }))
    .filter((ev) => ev.start instanceof Date && ev.end instanceof Date);
}

/**
 * Parked appointments (cards dragged onto the toolbar from the calendar grid).
 * Shape: { id, title, service, color, isParked, fromMove?, durationMinutes,
 *          waitlistAddedAt? }
 */
export function loadCalendarParked() {
  const data = readCalendarRoot();
  const list = Array.isArray(data?.parkedFromDrag) ? data.parkedFromDrag : [];
  return list
    .filter((p) => p && typeof p === 'object')
    .map((p) => ({
      ...p,
      ...(p.waitlistAddedAt ? { waitlistAddedAt: ensureDate(p.waitlistAddedAt) } : {}),
    }));
}

/**
 * Waitlist (toolbar) entries — clients waiting to be booked.
 * Shape: { id, title, service, color, waitlistAddedAt }
 */
export function loadCalendarWaitlist() {
  const data = readCalendarRoot();
  const list = Array.isArray(data?.toolbarEvents) ? data.toolbarEvents : [];
  return list
    .filter((t) => t && typeof t === 'object')
    .map((t) => ({
      ...t,
      ...(t.waitlistAddedAt ? { waitlistAddedAt: ensureDate(t.waitlistAddedAt) } : {}),
    }));
}

export function notifyCalendarUpdated() {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT_NAME));
  } catch {
    // ignore — environments without CustomEvent
  }
}

export function isSameLocalDay(a, b) {
  return (
    a instanceof Date &&
    b instanceof Date &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatTimeShort(d) {
  if (!(d instanceof Date)) return '';
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

function useCalendarSlice(load) {
  const [value, setValue] = useState(() => load());

  useEffect(() => {
    const refresh = () => setValue(load());

    const onStorage = (e) => {
      if (!e || e.key === CALENDAR_STORAGE_KEY || e.key === null) refresh();
    };

    window.addEventListener(UPDATE_EVENT_NAME, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(UPDATE_EVENT_NAME, refresh);
      window.removeEventListener('storage', onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return value;
}

export function useCalendarEvents() {
  return useCalendarSlice(loadCalendarEvents);
}

/** @type {Promise<unknown[]> | null} */
let stylistAppointmentsFetch = null;

function localDayBounds(d = new Date()) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Stylist / ClientList read appointments from session cache or the in-memory
 * mirror — both are filled when Calendar mounts. Bootstrap today's rows on
 * Stylist first visit so the waiting list is populated without opening Calendar.
 *
 * @param {{ signal?: AbortSignal, force?: boolean }} [opts]
 * @returns {Promise<unknown[]>}
 */
export async function ensureStylistAppointmentsCache(opts = {}) {
  if (!isAppointmentsApiAvailable()) {
    return loadCalendarEvents();
  }

  const existing = loadCalendarEvents();
  if (existing.length > 0 && !opts.force) {
    return existing;
  }

  if (stylistAppointmentsFetch) {
    return stylistAppointmentsFetch;
  }

  stylistAppointmentsFetch = (async () => {
    try {
      const { start, end } = localDayBounds();
      const rows = await fetchAppointmentsRange(start, end, { signal: opts.signal });
      if (opts.signal?.aborted) return loadCalendarEvents();

      const events = rows
        .map(appointmentDtoToEvent)
        .filter((ev) => ev.start instanceof Date && ev.end instanceof Date)
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      setApiModeCalendarEventsMirror(events);
      writeApiAppointmentsSessionCache(events);
      notifyCalendarUpdated();
      return events;
    } catch (err) {
      if (err?.name === 'AbortError' || err?.code === 20) {
        return loadCalendarEvents();
      }
      console.warn('[calendarEventsStore] stylist appointments bootstrap failed', err);
      return loadCalendarEvents();
    } finally {
      stylistAppointmentsFetch = null;
    }
  })();

  return stylistAppointmentsFetch;
}

export function useCalendarParked() {
  return useCalendarSlice(loadCalendarParked);
}

export function useCalendarWaitlist() {
  return useCalendarSlice(loadCalendarWaitlist);
}
