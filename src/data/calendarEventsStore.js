// Shared reader/subscriber for the Calendar screen's persisted events.
// Calendar.jsx is the single writer (localStorage key "@salonx/calendar/v1").
// Other screens (Stylist/ClientList, etc.) read via `useCalendarEvents()` and
// react to in-tab updates through the `salonx:calendar-updated` CustomEvent.

import { useEffect, useState } from 'react';

const CALENDAR_STORAGE_KEY = '@salonx/calendar/v1';
const UPDATE_EVENT_NAME = 'salonx:calendar-updated';

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

export function loadCalendarEvents() {
  if (typeof window === 'undefined') return [];
  try {
    const json = window.localStorage.getItem(CALENDAR_STORAGE_KEY);
    if (!json) return [];
    const data = deserialize(json);
    const events = Array.isArray(data?.events) ? data.events : [];
    return events
      .map((ev) => ({
        ...ev,
        start: ensureDate(ev.start),
        end: ensureDate(ev.end),
      }))
      .filter((ev) => ev.start instanceof Date && ev.end instanceof Date);
  } catch (err) {
    console.warn('[calendarEventsStore] load failed', err);
    return [];
  }
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

export function useCalendarEvents() {
  const [events, setEvents] = useState(() => loadCalendarEvents());

  useEffect(() => {
    const refresh = () => setEvents(loadCalendarEvents());

    const onStorage = (e) => {
      if (!e || e.key === CALENDAR_STORAGE_KEY || e.key === null) refresh();
    };

    window.addEventListener(UPDATE_EVENT_NAME, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(UPDATE_EVENT_NAME, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return events;
}
