// Shared per-appointment state store.
//
// Each Calendar appointment has its own bag of services, products, and stylist
// rates — keyed by the appointment id (the same `id` minted in Calendar.jsx
// when the event is created). Screen2 (client details) is the primary writer,
// Climax (checkout) is a reader, and the Stylist screen funnels the active
// appointment context through navigation `state` and a session fallback.
//
// Storage shape (localStorage `@salonx/appointmentState/v1`):
//   {
//     [aptKey]: {
//       svcQueue:    [{ id, name, kind?, price }, ...],
//       productQueue:[{ id, brand?, name, price, color? }, ...],
//       hourlyRate:  number,   // applied to the SVC-HOURLY row
//       consultRate: number,   // applied to the SVC-CONSULT row
//       updatedAt:   number,
//     }
//   }

export const APPT_STATE_STORAGE_KEY = '@salonx/appointmentState/v1';

// Session-only "last appointment" so a full refresh (which drops
// react-router `location.state`) still resumes the correct appointment.
export const SCREEN2_APT_SESSION_KEY = '@salonx/screen2LastApt/v1';

// Where Climax (checkout) should send the user when they tap Back — survives
// refresh when paired with navigation state from Screen2 / toolbar.
export const CLIMAX_BACK_SESSION_KEY = '@salonx/climaxBack/v1';

/** Per-appointment Screen2 step-through (CHECK→…→REBOOK); session-only. */
export const SCREEN2_WORKFLOW_SESSION_KEY = '@salonx/screen2Workflow/v1';

function readScreen2WorkflowStore() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(SCREEN2_WORKFLOW_SESSION_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

/** @returns {{ check?: boolean, consult?: boolean, services?: boolean, lift?: boolean, booking?: boolean } | null} */
export function readScreen2WorkflowForApt(aptKey) {
  if (!aptKey) return null;
  const rec = readScreen2WorkflowStore()[aptKey];
  if (!rec || typeof rec !== 'object') return null;
  return rec;
}

export function writeScreen2WorkflowForApt(aptKey, data) {
  if (typeof window === 'undefined' || !aptKey || !data || typeof data !== 'object') return;
  try {
    const store = readScreen2WorkflowStore();
    store[aptKey] = { ...data };
    sessionStorage.setItem(SCREEN2_WORKFLOW_SESSION_KEY, JSON.stringify(store));
  } catch {
    /* noop */
  }
}

// Anchor entries every queue starts with — Hourly + Consultation rows whose
// price is driven by hourlyRate / consultRate, not stored per-row.
export const SVC_HOURLY_BASE = { id: 'SVC-HOURLY', name: 'Hourly (stylist rate)', kind: 'hourly' };
export const SVC_CONSULT_BASE = { id: 'SVC-CONSULT', name: 'Consultation', kind: 'consult' };

export function makeEmptySvcQueue() {
  return [
    { ...SVC_HOURLY_BASE, price: 0 },
    { ...SVC_CONSULT_BASE, price: 0 },
  ];
}

export function loadApptStateStore() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(APPT_STATE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveApptStateStore(store) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(APPT_STATE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* noop */
  }
}

// Stable key per appointment. Prefers the Calendar-minted id; otherwise builds
// one from clientName + start so legacy nav payloads still resolve consistently.
export function apptStateKey(apt) {
  if (!apt) return '';
  if (apt.id) return String(apt.id);
  const start = apt.start ? new Date(apt.start).getTime() : '';
  return `${(apt.clientName || '').toLowerCase()}|${start}`;
}

export function getApptState(store, apt) {
  const key = apptStateKey(apt);
  const rec = (key && store[key]) || {};
  return {
    svcQueue:
      Array.isArray(rec.svcQueue) && rec.svcQueue.length
        ? rec.svcQueue
        : makeEmptySvcQueue(),
    productQueue: Array.isArray(rec.productQueue) ? rec.productQueue : [],
    hourlyRate: typeof rec.hourlyRate === 'number' ? rec.hourlyRate : 0,
    consultRate: typeof rec.consultRate === 'number' ? rec.consultRate : 0,
    updatedAt: typeof rec.updatedAt === 'number' ? rec.updatedAt : 0,
  };
}

export function readPersistedScreen2Apt() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SCREEN2_APT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && parsed.apt ? parsed.apt : null;
  } catch {
    return null;
  }
}

export function writePersistedScreen2Apt(apt, from) {
  if (typeof window === 'undefined' || !apt) return;
  try {
    sessionStorage.setItem(
      SCREEN2_APT_SESSION_KEY,
      JSON.stringify({ apt, from: from || null }),
    );
  } catch {
    /* noop */
  }
}

// Tracks where the user navigated to Screen2 *from* (e.g. '/calendar',
// '/screen1') so the in-screen Back button can return to the right place.
// Falls back to '/screen1' when nothing is stored.
export function readPersistedScreen2From() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SCREEN2_APT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && typeof parsed.from === 'string'
      ? parsed.from
      : null;
  } catch {
    return null;
  }
}

export function writePersistedClimaxBack(from) {
  if (typeof window === 'undefined' || !from || typeof from !== 'string') return;
  try {
    sessionStorage.setItem(CLIMAX_BACK_SESSION_KEY, from);
  } catch {
    /* noop */
  }
}

/** @returns {string | null} */
export function readPersistedClimaxBack() {
  if (typeof window === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(CLIMAX_BACK_SESSION_KEY);
    return v && v.startsWith('/') ? v : null;
  } catch {
    return null;
  }
}

// Build the lightweight `apt` payload that flows through navigation state.
// We keep it minimal so it round-trips cleanly via JSON in sessionStorage.
export function buildAptNavPayload(ev) {
  if (!ev) return null;
  return {
    id: ev.id,
    clientName: ev.clientName || '',
    service: ev.service || '',
    color: ev.color || null,
    price: typeof ev.price === 'number' ? ev.price : 0,
    notes: ev.notes || '',
    start: ev.start instanceof Date ? ev.start.toISOString() : ev.start,
    end: ev.end instanceof Date ? ev.end.toISOString() : ev.end,
  };
}

// Resolve the best appointment for a screen that didn't receive nav state —
// e.g. user opened Climax via the bottom toolbar. Order of preference:
//   1. router state (`location.state.apt`)
//   2. session-saved last apt (refresh-safe)
//   3. provided fallback (e.g. first appointment of today)
export function resolveActiveAppointment(navStateApt, fallbackApt) {
  if (navStateApt) return navStateApt;
  const session = readPersistedScreen2Apt();
  if (session) return session;
  return fallbackApt || null;
}
