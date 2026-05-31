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

// Calendar exit route + optional future-booking seed (Climax → Calendar flow).
export const CALENDAR_BACK_SESSION_KEY = '@salonx/calendarBack/v1';

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

/** Client phone saved with the Screen2 checkout session (S2 → Climax pipe). */
export function readPersistedScreen2ClientPhone() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SCREEN2_APT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const phone =
      parsed && typeof parsed === 'object' && typeof parsed.clientPhone === 'string'
        ? parsed.clientPhone.trim()
        : '';
    return phone || null;
  } catch {
    return null;
  }
}

export function writePersistedScreen2Apt(apt, from, clientPhone) {
  if (typeof window === 'undefined' || !apt) return;
  try {
    let phone =
      typeof clientPhone === 'string' && clientPhone.trim() ? clientPhone.trim() : null;
    if (!phone) {
      const raw = sessionStorage.getItem(SCREEN2_APT_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const existing =
          parsed && typeof parsed.clientPhone === 'string' ? parsed.clientPhone.trim() : '';
        if (existing) phone = existing;
      }
    }
    sessionStorage.setItem(
      SCREEN2_APT_SESSION_KEY,
      JSON.stringify({
        apt,
        from: from || null,
        ...(phone ? { clientPhone: phone } : {}),
      }),
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

/** @typedef {{ id: string, title: string, service?: string, color?: string, isParked: true, fromMove?: boolean, fromRebook?: boolean, durationMinutes: number, targetStart?: string, targetEnd?: string, price?: number, notes?: string }} RebookParkItem */

/** @typedef {{ from: string, bookFuture?: boolean, seedClient?: { clientName?: string } | null, rebookToPark?: RebookParkItem | null, goToDate?: string | null }} CalendarBackPayload */

/**
 * Build a toolbar parked card for S2 rebook → MOVE TO PARK (+4 weeks, not on grid).
 * @param {{ clientName?: string, service?: string, color?: string, price?: number, notes?: string }} apt
 * @param {{ start: Date, end: Date }} target
 * @param {string} [clientNameFallback]
 * @returns {RebookParkItem}
 */
export function buildRebookParkItem(apt, target, clientNameFallback = '') {
  const durationMinutes = Math.max(
    5,
    Math.round((target.end.getTime() - target.start.getTime()) / 60000) || 60,
  );
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `pk-rebook-${crypto.randomUUID()}`
      : `pk-rebook-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    title: apt?.clientName || clientNameFallback || '',
    service: apt?.service || '',
    color: apt?.color || '#25AFFF',
    isParked: true,
    fromMove: false,
    fromRebook: true,
    durationMinutes,
    targetStart: target.start.toISOString(),
    targetEnd: target.end.toISOString(),
    price: typeof apt?.price === 'number' ? apt.price : 0,
    notes: apt?.notes || '',
    ...(apt?.id ? { sourceAppointmentId: String(apt.id) } : {}),
  };
}

/** @param {string} from @param {{ bookFuture?: boolean, seedClient?: { clientName?: string } | null, rebookToPark?: RebookParkItem | null, goToDate?: string | null }} [extras] */
export function writePersistedCalendarBack(from, extras = {}) {
  if (typeof window === 'undefined' || !from || typeof from !== 'string') return;
  try {
    sessionStorage.setItem(
      CALENDAR_BACK_SESSION_KEY,
      JSON.stringify({
        from,
        bookFuture: Boolean(extras.bookFuture),
        seedClient: extras.seedClient || null,
        rebookToPark: extras.rebookToPark || null,
        goToDate: typeof extras.goToDate === 'string' ? extras.goToDate : null,
      }),
    );
  } catch {
    /* noop */
  }
}

/** Drop one-shot S2/Climax navigation intents — must not re-run after calendar reload. */
export function clearPersistedCalendarNavIntents() {
  const persisted = readPersistedCalendarBack();
  if (!persisted?.from) return;
  if (!persisted.rebookToPark && !persisted.goToDate && !persisted.bookFuture) return;
  writePersistedCalendarBack(persisted.from, {
    bookFuture: false,
    seedClient: null,
    rebookToPark: null,
    goToDate: null,
  });
}

/** @returns {CalendarBackPayload | null} */
export function readPersistedCalendarBack() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CALENDAR_BACK_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const from = typeof parsed.from === 'string' && parsed.from.startsWith('/') ? parsed.from : null;
    if (!from) return null;
    return {
      from,
      bookFuture: Boolean(parsed.bookFuture),
      seedClient:
        parsed.seedClient && typeof parsed.seedClient === 'object' ? parsed.seedClient : null,
      rebookToPark:
        parsed.rebookToPark && typeof parsed.rebookToPark === 'object'
          ? parsed.rebookToPark
          : null,
      goToDate: typeof parsed.goToDate === 'string' ? parsed.goToDate : null,
    };
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
