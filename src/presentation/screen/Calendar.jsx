import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  addDays,
  addMinutes,
  addMonths,
  addWeeks,
  differenceInMinutes,
  format,
  parse,
  isSameDay,
  isSameMonth,
  isToday,
  startOfWeek,
  startOfMonth,
  startOfDay,
  endOfMonth,
  endOfWeek,
} from "date-fns";
import { Bell, ClipboardText, PencilSimpleLine, Plus, UserList, X } from "phosphor-react";
import { useRunningTimers, useTimers } from "../../context/TimersContext";
import {
  NewCustomerScreen,
  NewServiceScreen,
  PickerTrigger,
  SearchablePickerModal,
} from "../../component/calendar/CalendarOverlays";
import { MOCK_CLIENTS } from "../../data/mockClients";
import { MOCK_SERVICES } from "../../data/mockServices";
import {
  notifyCalendarUpdated,
  persistToolbarToCalendarStorage,
  removeAppointmentFromSessionCache,
  setApiModeCalendarEventsMirror,
  stripLegacyMockToolbarEntries,
  toolbarHadLegacyMockEntries,
  upsertAppointmentInSessionCache,
} from "../../data/calendarEventsStore.js";
import {
  appointmentDtoToEvent,
  createAppointmentRemote,
  deleteAppointmentRemote,
  fetchAppointmentsRange,
  isAppointmentsApiAvailable,
  updateAppointmentRemote,
} from "../../data/v2AppointmentsApi.js";
import {
  fetchClientsCatalog,
  fetchServiceCatalog,
  saveClientsCatalogRemote,
  saveServiceCatalogRemote,
} from "../../data/calendarCatalogApi.js";
import {
  fetchCalendarToolbar,
  saveCalendarToolbarRemote,
} from "../../data/calendarToolbarApi.js";
import {
  readApiAppointmentsSessionCache,
  writeApiAppointmentsSessionCache,
} from "../../data/apiAppointmentsSessionCache.js";
import { startCalendarRealtimeSync } from "../../sync/calendarRealtimeSync.js";
import {
  clearPersistedCalendarNavIntents,
  readPersistedCalendarBack,
  writePersistedCalendarBack,
} from "../../data/appointmentStateStore.js";
import "../style/calendar.css";

// The day grid spans the full 24-hour clock (midnight → midnight) so the
// stylist can drag/scroll an appointment to any time of day. The viewport is
// shorter than the grid, so .cal-day__scroll handles native vertical scrolling
// and we land the initial scrollTop at DAY_INITIAL_HOUR (08:00 — typical salon
// opening time) every time a day pane mounts.
const DAY_START_HOUR = 0;
// 24 = end-of-day boundary (renders as the bottom 12 AM row, i.e. next-day
// midnight). All clamps key off (DAY_END_HOUR - DAY_START_HOUR) * 60 minutes.
const DAY_END_HOUR = 24;
const DAY_INITIAL_HOUR = 8;
const SLOT_HEIGHT = 56;
// Axis width sized so iOS Safari renders "12 AM"/"10 PM" cleanly (the system
// font there is slightly wider than desktop). Right-aligned labels sit just
// before the gridline (Apple Calendar parity).
const TIME_AXIS_WIDTH = 50;
// Minutes from DAY_START_HOUR up to (and including) the DAY_END_HOUR row.
// 24 h × 60 min = 1440 min — full day; latest valid end time is midnight.
const MINUTES_PER_DAY = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const SNAP_MINUTES = 5;
const FUTURE_BOOK_DEFAULT_HOUR = 9;
const FUTURE_BOOK_DEFAULT_MINUTE = 0;
const COLOR_OPTIONS = [
  { id: "pink", label: "Pink", swatch: "#FA1BFE" },
  { id: "blue", label: "Blue", swatch: "#25AFFF" },
  { id: "green", label: "Green", swatch: "#9DE684" },
  { id: "gray", label: "Gray", swatch: "#8e8e93" },
];

function ArrowIcon({ dir = "left" }) {
  return (
    <svg
      className={`cal-arrow ${dir === "right" ? "is-right" : ""}`}
      width="16"
      height="10"
      viewBox="0 0 15.6059 10.1073"
      fill="none"
      aria-hidden="true"
    >
      <g>
        <path
          d="M4.74241 4.97939L8.48012 0.307264L4.11946 0.307263L0.381754 4.97939L4.11946 9.80726L8.48011 9.80726L4.74241 4.97939Z"
          stroke="currentColor"
          strokeWidth="0.6"
        />
        <path
          d="M14.8228 0.299999L12.0195 0.299999L8.12607 4.97213L12.0195 9.8L14.9785 9.8L11.0851 4.97213L14.8228 0.299999Z"
          stroke="currentColor"
          strokeWidth="0.6"
        />
      </g>
    </svg>
  );
}

// Seeded appointments repeat on every day in range so Calendar month/week/day
// views stay populated in mock mode (and demo-api fallback when DB is empty).
const MOCK_APPT_DAY_TEMPLATES = [
  {
    idSuffix: "1",
    clientName: "Cristi Curls",
    service: "Extension Install",
    startH: 10,
    startM: 0,
    endH: 11,
    endM: 0,
    color: "pink",
  },
  {
    idSuffix: "2",
    clientName: "Jon Klein",
    service: "Full lived-in colour",
    startH: 10,
    startM: 30,
    endH: 11,
    endM: 15,
    color: "blue",
  },
  {
    idSuffix: "3",
    clientName: "Joe Styles",
    service: "Men's haircut & color",
    startH: 12,
    startM: 45,
    endH: 13,
    endM: 45,
    color: "gray",
  },
  {
    idSuffix: "4",
    clientName: "Nita Haredoo",
    service: "Extensions and colour",
    startH: 15,
    startM: 30,
    endH: 16,
    endM: 0,
    color: "green",
  },
];

function shouldUseMockAppointmentFallback() {
  return (
    String(import.meta.env.VITE_DEV_USE_DEMO_API || "").toLowerCase() === "true"
  );
}

function mockAppointmentFetchRange() {
  const anchor = new Date();
  return {
    from: addDays(anchor, -120),
    to: addDays(anchor, 240),
  };
}

function buildMockAppointmentsForRange(fromDate, toDate) {
  const events = [];
  let day = startOfDay(fromDate);
  const end = startOfDay(toDate);
  while (day.getTime() <= end.getTime()) {
    const dayKey = format(day, "yyyy-MM-dd");
    for (const t of MOCK_APPT_DAY_TEMPLATES) {
      events.push({
        id: `mock-${dayKey}-${t.idSuffix}`,
        clientName: t.clientName,
        service: t.service,
        start: new Date(day.getFullYear(), day.getMonth(), day.getDate(), t.startH, t.startM),
        end: new Date(day.getFullYear(), day.getMonth(), day.getDate(), t.endH, t.endM),
        color: t.color,
      });
    }
    day = addDays(day, 1);
  }
  return events;
}

function buildInitialMockAppointments() {
  const { from, to } = mockAppointmentFetchRange();
  return buildMockAppointmentsForRange(from, to);
}

function minutesSinceStart(d) {
  return (d.getHours() - DAY_START_HOUR) * 60 + d.getMinutes();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function overlaps(a, b) {
  return a.start < b.end && a.end > b.start;
}

function layoutDayAppointments(apts) {
  const sorted = [...apts].sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() ||
      a.end.getTime() - b.end.getTime() ||
      String(a.id).localeCompare(String(b.id)),
  );

  // Build overlap "clusters" so column counts are local, not global. This
  // prevents unrelated appointments from shrinking when a single overlap
  // happens elsewhere in the day.
  const clusters = [];
  let current = null; // { items: [], endMs: number }
  for (const apt of sorted) {
    const s = apt.start.getTime();
    const e = apt.end.getTime();
    if (!current) {
      current = { items: [apt], endMs: e };
      continue;
    }
    if (s < current.endMs) {
      current.items.push(apt);
      current.endMs = Math.max(current.endMs, e);
    } else {
      clusters.push(current);
      current = { items: [apt], endMs: e };
    }
  }
  if (current) clusters.push(current);

  const positioned = [];
  for (const cluster of clusters) {
    // Greedy interval graph coloring within the cluster.
    // columnsEndMs[i] = end time of the last apt in column i.
    const columnsEndMs = [];
    for (const apt of cluster.items) {
      const s = apt.start.getTime();
      let colIndex = -1;
      for (let i = 0; i < columnsEndMs.length; i += 1) {
        if (s >= columnsEndMs[i]) {
          colIndex = i;
          break;
        }
      }
      if (colIndex === -1) {
        colIndex = columnsEndMs.length;
        columnsEndMs.push(apt.end.getTime());
      } else {
        columnsEndMs[colIndex] = apt.end.getTime();
      }
      positioned.push({
        apt,
        colIndex,
        totalCols: 0, // filled after we know cluster width
      });
    }
    const totalCols = Math.max(1, columnsEndMs.length);
    // Backfill totalCols for just this cluster range (last N items pushed).
    for (let i = positioned.length - cluster.items.length; i < positioned.length; i += 1) {
      positioned[i].totalCols = totalCols;
    }
  }

  return positioned;
}

function colorToClass(c) {
  if (c === "pink") return "is-pink";
  if (c === "blue") return "is-blue";
  if (c === "green") return "is-green";
  return "is-gray";
}

function colorToDotClass(c) {
  if (c === "pink") return "is-pink";
  if (c === "blue") return "is-blue";
  if (c === "green") return "is-green";
  return "is-gray";
}

function snapMinutes(min, snap = SNAP_MINUTES) {
  return Math.round(min / snap) * snap;
}

/**
 * Returns true if placing `candidate` together with `others` would create any
 * 3-way (or larger) overlap inside the candidate's time range. The "max 2
 * concurrent" rule mirrors the RN app's overbookCheck.
 */
function wouldCauseThirdOverlap(others, candidate) {
  const concurrent = others.filter((o) => overlaps(o, candidate));
  for (let i = 0; i < concurrent.length; i += 1) {
    for (let j = i + 1; j < concurrent.length; j += 1) {
      const a = concurrent[i];
      const b = concurrent[j];
      const start = Math.max(
        a.start.getTime(),
        b.start.getTime(),
        candidate.start.getTime(),
      );
      const end = Math.min(
        a.end.getTime(),
        b.end.getTime(),
        candidate.end.getTime(),
      );
      if (start < end) return true;
    }
  }
  return false;
}

const PARK_DROP_THRESHOLD = 14; // px above grid top counts as park drop

// Tap interaction tuning
const LONG_PRESS_MS = 1000; // 1s — long-press to enter drag/move mode (more responsive)
const DOUBLE_TAP_MS = 360; // 2nd tap window — slightly loose for iOS PWA / touch

// Drag usability: auto-scroll the time grid when the pointer is near edges.
const AUTO_SCROLL_EDGE_PX = 56; // ~1 row
const AUTO_SCROLL_STEP_PX = 14; // per pointermove

function fmtTimeOfDay(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const date = new Date(0, 0, 0, h, m);
  return format(date, "h:mm a");
}

function makeEventId() {
  // Must be globally unique across refreshes + persisted localStorage,
  // otherwise React keys & drag state can "match" multiple cards and they move together.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `ev-${crypto.randomUUID()}`;
  }
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function releasePointerCaptureIfHeld(target, pointerId) {
  if (!target || pointerId == null) return;
  try {
    if (typeof target.releasePointerCapture === "function") {
      target.releasePointerCapture(pointerId);
    }
  } catch {
    /* already released or invalid */
  }
}

// ---------- Phase 5: localStorage persistence ----------
const CALENDAR_STORAGE_KEY = "@salonx/calendar/v1";

/** True on hard refresh (F5) — avoid painting stale cached appointments before server fetch. */
function isBrowserReloadNavigation() {
  if (typeof performance === "undefined") return false;
  const nav = performance.getEntriesByType("navigation")[0];
  if (nav?.type === "reload") return true;
  // Legacy Navigation Timing API (some WebViews)
  if (typeof performance.navigation !== "undefined" && performance.navigation.type === 1) {
    return true;
  }
  return false;
}

const CALENDAR_VIEW_SESSION_KEY = "@salonx/calendar-view/v1";

function readPersistedCalendarView() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CALENDAR_VIEW_SESSION_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    let currentDate = null;
    if (typeof o.dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.dateKey)) {
      currentDate = parse(o.dateKey, "yyyy-MM-dd", new Date());
    } else if (typeof o.currentDate === "string") {
      const parsed = new Date(o.currentDate);
      if (!Number.isNaN(parsed.getTime())) {
        currentDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      }
    }
    if (!currentDate || Number.isNaN(currentDate.getTime())) return null;
    const vm = o.viewMode;
    const viewMode = vm === "week" || vm === "month" ? vm : "day";
    return { currentDate, viewMode };
  } catch {
    return null;
  }
}

function writePersistedCalendarView(currentDate, viewMode) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      CALENDAR_VIEW_SESSION_KEY,
      JSON.stringify({
        dateKey: format(currentDate, "yyyy-MM-dd"),
        viewMode,
      }),
    );
  } catch {
    /* quota */
  }
}

function reviveDate(value) {
  if (value && typeof value === "object" && value.__type === "Date") {
    return new Date(value.value);
  }
  return value;
}

function serializeCalendarState(state) {
  return JSON.stringify(state, (_key, value) => {
    if (value instanceof Date) return { __type: "Date", value: value.toISOString() };
    return value;
  });
}

function deserializeCalendarState(json) {
  return JSON.parse(json, (_key, value) => reviveDate(value));
}

function ensureDate(value) {
  if (value == null) return value;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function reviveCalendarSlices(data) {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data.events)) {
    data.events = data.events
      .map((ev) => ({
        ...ev,
        start: ensureDate(ev.start),
        end: ensureDate(ev.end),
      }))
      .filter((ev) => ev.start instanceof Date && ev.end instanceof Date);
  }
  if (Array.isArray(data.toolbarEvents)) {
    data.toolbarEvents = data.toolbarEvents.map((t) => ({
      ...t,
      waitlistAddedAt: t.waitlistAddedAt ? ensureDate(t.waitlistAddedAt) : undefined,
    }));
  }
  if (Array.isArray(data.parkedFromDrag)) {
    data.parkedFromDrag = data.parkedFromDrag.map((p) => ({
      ...p,
      ...(p.waitlistAddedAt ? { waitlistAddedAt: ensureDate(p.waitlistAddedAt) } : {}),
    }));
  }
  const cleaned = stripLegacyMockToolbarEntries(data.parkedFromDrag, data.toolbarEvents);
  data.parkedFromDrag = cleaned.parkedFromDrag;
  data.toolbarEvents = cleaned.toolbarEvents;
  return data;
}

function mergeParkedToolbarRows(serverParked, localParked) {
  const server = Array.isArray(serverParked) ? serverParked : [];
  const local = Array.isArray(localParked) ? localParked : [];
  const serverIds = new Set(server.map((p) => String(p?.id)));
  const pending = local.filter(
    (p) => p?.id != null && !serverIds.has(String(p.id)),
  );
  return [...server, ...pending];
}

function mergeRebookParkItem(list, item) {
  if (!item || typeof item !== "object") return Array.isArray(list) ? list : [];
  const base = Array.isArray(list) ? list : [];
  if (base.some((p) => String(p.id) === String(item.id))) return base;
  return [...base, item];
}

function loadPersistedCalendar() {
  if (typeof window === "undefined") return null;
  try {
    const json = window.localStorage.getItem(CALENDAR_STORAGE_KEY);
    if (!json) return null;
    return reviveCalendarSlices(deserializeCalendarState(json));
  } catch (err) {
    console.warn("[Calendar] failed to load persisted state", err);
    return null;
  }
}

function persistCalendar(state, options = {}) {
  const { skipEvents = false } = options;
  if (isAppointmentsApiAvailable()) {
    if (skipEvents) {
      persistToolbarToCalendarStorage(state.parkedFromDrag, state.toolbarEvents);
    }
    return;
  }
  const slice = skipEvents
    ? {
        clients: state.clients,
        serviceCatalog: state.serviceCatalog,
        parkedFromDrag: state.parkedFromDrag,
        toolbarEvents: state.toolbarEvents,
      }
    : state;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CALENDAR_STORAGE_KEY, serializeCalendarState(slice));
    // Notify in-tab subscribers (Stylist screen, etc.) since `storage` events
    // do not fire for same-tab writes.
    try {
      window.dispatchEvent(new CustomEvent("salonx:calendar-updated"));
    } catch {
      // ignore environments without CustomEvent
    }
  } catch (err) {
    console.warn("[Calendar] failed to persist state", err);
  }
}

export default function CalendarScreenWeb() {
  const persisted = useMemo(() => loadPersistedCalendar(), []);
  const runningTimers = useRunningTimers();
  const { clearTimer } = useTimers();
  const navigate = useNavigate();
  const location = useLocation();

  const calendarBackTarget = useMemo(() => {
    const fromState = location?.state?.from;
    if (
      typeof fromState === "string" &&
      fromState.startsWith("/") &&
      fromState !== "/calendar"
    ) {
      return fromState;
    }
    const persisted = readPersistedCalendarBack();
    if (persisted?.from && persisted.from !== "/calendar") return persisted.from;
    return "/screen1";
  }, [location.key, location?.state?.from]);

  const bookFutureCtx = useMemo(() => {
    if (location?.state?.bookFuture) {
      return {
        active: true,
        seedClientName:
          typeof location?.state?.seedClient?.clientName === "string"
            ? location.state.seedClient.clientName
            : "",
      };
    }
    return { active: false, seedClientName: "" };
  }, [location.key, location?.state?.bookFuture, location?.state?.seedClient]);

  const rebookToParkCtx = useMemo(() => {
    const fromState = location?.state?.rebookToPark;
    if (fromState && typeof fromState === "object") {
      return {
        active: true,
        item: fromState,
        goToDate:
          typeof location?.state?.goToDate === "string"
            ? location.state.goToDate
            : typeof fromState.targetStart === "string"
              ? fromState.targetStart
              : null,
      };
    }
    return { active: false, item: null, goToDate: null };
  }, [location.key, location?.state?.rebookToPark, location?.state?.goToDate]);

  useEffect(() => {
    const fromNav = location?.state?.from;
    if (
      typeof fromNav !== "string" ||
      !fromNav.startsWith("/") ||
      fromNav === "/calendar"
    ) {
      return;
    }
    writePersistedCalendarBack(fromNav, {
      bookFuture: Boolean(location?.state?.bookFuture),
      seedClient: location?.state?.seedClient || null,
      rebookToPark: location?.state?.rebookToPark || null,
      goToDate:
        typeof location?.state?.goToDate === "string" ? location.state.goToDate : null,
    });
  }, [
    location.key,
    location?.state?.from,
    location?.state?.bookFuture,
    location?.state?.seedClient,
    location?.state?.rebookToPark,
    location?.state?.goToDate,
  ]);

  // Tap dispatcher — double tap opens appointment options (single tap is inert)
  const tapRef = useRef({ aptId: null, lastTapTs: 0, pendingTimer: null });
  // Mobile browsers can synthesize a click after pointerup/touchend. If we open
  // the modal on that same tick, the synthetic click can land on a modal button
  // (e.g. Reschedule) and feel like a "sub popup" opened from one tap.
  const suppressModalClickUntilRef = useRef(0);
  /** Abort initial / in-flight list fetch so a stale response cannot overwrite optimistic saves. */
  const appointmentsFetchAbortRef = useRef(null);
  /** Bumps on each list-fetch start and on save/delete — stale async completions must not call setEvents. */
  const appointmentsListFetchTokenRef = useRef(0);
  /** After first appointments list fetch attempt (success or hard failure). */
  const appointmentsInitialFetchDoneRef = useRef(false);
  /** After first calendar-toolbar GET finishes — avoids PUT clobbering server before hydrate. */
  const [calendarToolbarRemoteReady, setCalendarToolbarRemoteReady] = useState(
    () => !isAppointmentsApiAvailable(),
  );
  const [calendarCatalogRemoteReady, setCalendarCatalogRemoteReady] = useState(
    () => !isAppointmentsApiAvailable(),
  );
  const toolbarUpdatedAtRef = useRef(null);
  const clientsCatalogUpdatedAtRef = useRef(null);
  const serviceCatalogUpdatedAtRef = useRef(null);
  /** Skip debounced PUT after Socket.IO / GET hydrate — avoids 409 echo loops. */
  const suppressServerPersistUntilRef = useRef(0);
  const pauseServerPersist = useCallback((ms = 700) => {
    suppressServerPersistUntilRef.current = Date.now() + ms;
  }, []);
  const shouldSkipServerPersist = useCallback(
    () => Date.now() < suppressServerPersistUntilRef.current,
    [],
  );

  /** Push toolbar JSON to server immediately (don't wait for 150ms debounce). */
  const pushToolbarToServer = useCallback(
    async (nextParked, nextToolbar) => {
      if (!isAppointmentsApiAvailable() || !calendarToolbarRemoteReady) return;
      try {
        const data = await saveCalendarToolbarRemote({
          parkedFromDrag: nextParked,
          toolbarEvents: nextToolbar,
          ...(toolbarUpdatedAtRef.current
            ? { expectedUpdatedAt: toolbarUpdatedAtRef.current }
            : {}),
        });
        if (data?.updatedAt) toolbarUpdatedAtRef.current = data.updatedAt;
      } catch (err) {
        if (err?.code === "CONFLICT" && err.payload) {
          pauseServerPersist();
          const revived = reviveCalendarSlices({
            parkedFromDrag: err.payload.parkedFromDrag,
            toolbarEvents: err.payload.toolbarEvents,
          });
          const serverParked = Array.isArray(revived.parkedFromDrag)
            ? revived.parkedFromDrag
            : [];
          const serverToolbar = Array.isArray(revived.toolbarEvents)
            ? revived.toolbarEvents
            : [];
          setParkedFromDrag((prev) => mergeParkedToolbarRows(serverParked, prev));
          setToolbarEvents(serverToolbar);
          if (err.payload.updatedAt) {
            toolbarUpdatedAtRef.current = err.payload.updatedAt;
          }
          return;
        }
        console.warn("[Calendar] toolbar sync failed", err);
      }
    },
    [calendarToolbarRemoteReady, pauseServerPersist],
  );

  const initialCalendarViewRef = useRef(null);
  if (initialCalendarViewRef.current === null) {
    initialCalendarViewRef.current = readPersistedCalendarView();
  }
  const initialCalendarView = initialCalendarViewRef.current;

  const [viewMode, setViewMode] = useState(() => initialCalendarView?.viewMode || "day");
  const [currentDate, setCurrentDate] = useState(() => startOfDay(new Date()));
  const [events, setEvents] = useState(() => {
    if (isAppointmentsApiAvailable()) {
      if (isBrowserReloadNavigation()) return [];
      const cached = readApiAppointmentsSessionCache();
      if (Array.isArray(cached) && cached.length > 0) return cached;
      return [];
    }
    return persisted?.events || buildInitialMockAppointments();
  });
  const [now, setNow] = useState(() => new Date());

  // Customer + service catalog — from API/DB when demo-api is configured; mocks only offline.
  const [clients, setClients] = useState(() => {
    if (isAppointmentsApiAvailable()) {
      return Array.isArray(persisted?.clients) && persisted.clients.length > 0
        ? persisted.clients
        : [];
    }
    return persisted?.clients || MOCK_CLIENTS;
  });
  const [serviceCatalog, setServiceCatalog] = useState(() => {
    if (isAppointmentsApiAvailable()) {
      return Array.isArray(persisted?.serviceCatalog) && persisted.serviceCatalog.length > 0
        ? persisted.serviceCatalog
        : [];
    }
    return persisted?.serviceCatalog || MOCK_SERVICES;
  });

  // Phase 1 modal/overlay state
  const [aptOptionsApt, setAptOptionsApt] = useState(null); // appointment object
  /** Month view: which day is selected for the bottom appointment sheet (stays in Month). */
  const [monthSheetDate, setMonthSheetDate] = useState(null);
  const [emptySlotInfo, setEmptySlotInfo] = useState(null); // { date, hour, minute }
  const [newApptInit, setNewApptInit] = useState(null); // initial start Date for NewAppt overlay
  const [newApptSeedClient, setNewApptSeedClient] = useState(null);
  const [editingApt, setEditingApt] = useState(null); // appointment being modified
  const [confirmCancelApt, setConfirmCancelApt] = useState(null);

  const bookFutureEnteredRef = useRef(false);
  const rebookParkHandledRef = useRef(false);
  /** Set after `refetchAppointmentsFromServer` is defined — early handlers call this after REST mutations. */
  const refreshAppointmentsRef = useRef(async () => {});

  useEffect(() => {
    writePersistedCalendarView(currentDate, viewMode);
  }, [currentDate, viewMode]);

  useEffect(() => {
    if (!isBrowserReloadNavigation()) return;
    clearPersistedCalendarNavIntents();
  }, []);

  useEffect(() => {
    if (!bookFutureCtx.active || bookFutureEnteredRef.current) return;
    if (rebookToParkCtx.active) return;
    bookFutureEnteredRef.current = true;
    setViewMode("month");
  }, [bookFutureCtx.active, rebookToParkCtx.active]);

  // Opening Calendar (toolbar / S1 / Climax) lands on today — not last session date.
  useEffect(() => {
    if (isBrowserReloadNavigation()) return;

    const persistedNav = readPersistedCalendarBack();
    const hasRebookIntent =
      (location?.state?.rebookToPark &&
        typeof location.state.rebookToPark === "object") ||
      (persistedNav?.rebookToPark && typeof persistedNav.rebookToPark === "object");
    if (hasRebookIntent) return;
    if (bookFutureCtx.active) return;
    if (typeof location?.state?.goToDate === "string") return;

    setCurrentDate(startOfDay(new Date()));
    setViewMode("day");
    setMonthSheetDate(null);
  }, [
    location.key,
    bookFutureCtx.active,
    location?.state?.rebookToPark,
    location?.state?.goToDate,
  ]);

  const handleExitCalendar = useCallback(() => {
    setNewApptInit(null);
    setEditingApt(null);
    setEmptySlotInfo(null);
    setMonthSheetDate(null);
    setNewApptSeedClient(null);
    setAptOptionsApt(null);
    writePersistedCalendarBack(calendarBackTarget);
    navigate(calendarBackTarget);
  }, [navigate, calendarBackTarget]);

  // One-time safety: legacy persisted data could have duplicate ids which
  // makes drag state (`dragApt === apt.id`) match multiple cards.
  useEffect(() => {
    if (isAppointmentsApiAvailable()) return;
    setEvents((prev) => {
      const seen = new Set();
      let mutated = false;
      const out = prev.map((ev) => {
        if (!ev.id || seen.has(ev.id)) {
          mutated = true;
          return { ...ev, id: makeEventId() };
        }
        seen.add(ev.id);
        return ev;
      });
      return mutated ? out : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddClient = useCallback((client) => {
    setClients((prev) => [client, ...prev]);
  }, []);

  const handleAddService = useCallback((svc) => {
    setServiceCatalog((prev) => [svc, ...prev]);
  }, []);

  // ---------- Phase 3: drag + resize + park + overlap guard ----------
  const [parkedFromDrag, setParkedFromDrag] = useState(() => {
    if (isAppointmentsApiAvailable()) return [];
    return Array.isArray(persisted?.parkedFromDrag) ? persisted.parkedFromDrag : [];
  }); // appointments dragged to toolbar — API mode hydrates from DB
  const [toolbarEvents, setToolbarEvents] = useState(() => {
    if (isAppointmentsApiAvailable()) return [];
    return Array.isArray(persisted?.toolbarEvents) ? persisted.toolbarEvents : [];
  });
  /** Park toolbar ids — grid must hide these even after server refetch. */
  const parkedAppointmentIdsRef = useRef(new Set());
  /** Set after refetch helper — S2/calendar park source purge. */
  const purgeSourceForParkRef = useRef(null);

  // S2 rebook → MOVE TO PARK (offline only — API mode merges in toolbar hydrate).
  useEffect(() => {
    if (isBrowserReloadNavigation()) return;
    if (isAppointmentsApiAvailable()) return;
    const persistedNav = readPersistedCalendarBack();
    const fromState =
      location?.state?.rebookToPark &&
      typeof location.state.rebookToPark === "object"
        ? location.state.rebookToPark
        : persistedNav?.rebookToPark && typeof persistedNav.rebookToPark === "object"
          ? persistedNav.rebookToPark
          : null;
    if (!fromState) return;
    if (rebookParkHandledRef.current) return;

    rebookParkHandledRef.current = true;
    const item = fromState;

    setViewMode("day");
    setCurrentDate(startOfDay(new Date()));
    setMonthSheetDate(null);
    setNewApptInit(null);
    setNewApptSeedClient(null);
    setEmptySlotInfo(null);

    if (item.sourceAppointmentId) {
      purgeSourceForParkRef.current?.(item.sourceAppointmentId, {
        parkItemId: item.id,
      });
    }

    setParkedFromDrag((prev) => {
      const next = mergeRebookParkItem(prev, item);
      if (item?.id != null) parkedAppointmentIdsRef.current.add(String(item.id));
      return next;
    });

    writePersistedCalendarBack(calendarBackTarget);
    clearPersistedCalendarNavIntents();
  }, [
    location.key,
    location?.state?.rebookToPark,
    location?.state?.goToDate,
    calendarBackTarget,
  ]);

  const [overlapAlert, setOverlapAlert] = useState(null); // { message }

  // Live drag tooltip ({ x, y, label }) following the pointer during a move
  const [dragTooltip, setDragTooltip] = useState(null);
  // 2D pointer offset for the dragging apt: { dx, dy } (px from press point)
  const [dragOffset, setDragOffset] = useState(null);
  /** Live preview minutes (snapped) while moving — used to update the card's
   *  time text continuously during drag without mutating events state. */
  const [dragPreviewMin, setDragPreviewMin] = useState(null);
  // For resize mode — px height delta applied via inline style without mutating events
  const [resizeDelta, setResizeDelta] = useState(0);
  // Whether the pointer is currently hovering inside the park area
  const [parkHover, setParkHover] = useState(false);
  // Confirm modal after drop: { kind: 'move' | 'park' | 'resize', original, currentStart?, currentEnd?, durationMin? }
  const [moveConfirm, setMoveConfirm] = useState(null);
  // Follow-up notify confirm — { clientName, action: 'moved'|'resized'|'parked' }
  const [notifyConfirm, setNotifyConfirm] = useState(null);

  // ---------- Phase 5+ — waitlist drag-to-book ----------
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  const [waitlistDrag, setWaitlistDrag] = useState(null); // { item, x, y } during drag
  const waitlistDragRef = useRef({
    itemId: null,
    pointerId: null,
    startX: 0,
    startY: 0,
    longPressTimer: null,
    activated: false,
    dayGridRect: null,
  });

  // Parked overflow modal + drag
  const [parkedModalOpen, setParkedModalOpen] = useState(false);
  const [parkedDrag, setParkedDrag] = useState(null);
  const parkedDragRef = useRef({
    itemId: null,
    pointerId: null,
    startX: 0,
    startY: 0,
    longPressTimer: null,
    activated: false,
    dayGridRect: null,
  });

  /** DOM nodes that currently hold pointer capture during waitlist / parked toolbar drags. */
  const waitlistPointerCaptureElRef = useRef(null);
  const parkedPointerCaptureElRef = useRef(null);

  // Book-from-list confirm modal
  // { kind: 'waitlist' | 'parked', item, start, end }
  const [bookConfirm, setBookConfirm] = useState(null);

  // ---------- Phase 4: reschedule + conflict resolver ----------
  const [rescheduleApt, setRescheduleApt] = useState(null); // appointment being rescheduled
  const [conflictItem, setConflictItem] = useState(null); // { remaining: [...occurrences], current: {start,end,sourceApt}, suggestions: [Date,...] }
  const [dragApt, setDragApt] = useState(null); // active drag apt id
  const dragRef = useRef({
    aptId: null,
    pointerId: null,
    mode: "idle", // 'pre' | 'move' | 'resize'
    startY: 0,
    startX: 0,
    anchorMin: 0,
    anchorDur: 0,
    original: null,
    longPressTimer: null,
    gridRect: null,
    toolbarRect: null,
    cancelled: false,
    pressYInGrid: 0,
  });

  /** Coalesce drag paint to one React update per frame (Safari suffers on per-move setState). */
  const dragPaintRafRef = useRef(null);
  const dragPaintSampleRef = useRef(null); // { clientX, clientY, aptId, currentTarget }

  const cancelDragPaintRaf = useCallback(() => {
    if (dragPaintRafRef.current != null) {
      cancelAnimationFrame(dragPaintRafRef.current);
      dragPaintRafRef.current = null;
    }
    dragPaintSampleRef.current = null;
  }, []);

  /** Ghost follow for waitlist / parked portals — same rAF coalescing. */
  const waitlistGhostRafRef = useRef(null);
  const waitlistGhostSampleRef = useRef(null); // { x, y }
  const parkedGhostRafRef = useRef(null);
  const parkedGhostSampleRef = useRef(null);

  const cancelLongPress = useCallback(() => {
    if (dragRef.current.longPressTimer) {
      clearTimeout(dragRef.current.longPressTimer);
      dragRef.current.longPressTimer = null;
    }
  }, []);

  const finishDrag = useCallback(() => {
    cancelDragPaintRaf();
    setDragApt(null);
    dragRef.current = {
      aptId: null,
      pointerId: null,
      mode: "idle",
      startY: 0,
      startX: 0,
      anchorMin: 0,
      anchorDur: 0,
      original: null,
      longPressTimer: null,
      gridRect: null,
      toolbarRect: null,
      cancelled: false,
      pressYInGrid: 0,
    };
  }, [cancelDragPaintRaf]);

  /** Options modal (Modify / Reschedule / …) — requires double tap; shared by day apt cards + month sheet. */
  const scheduleAppointmentOptionsDoubleTap = useCallback((apt) => {
    const now = Date.now();
    const isDouble =
      tapRef.current.aptId === apt.id && now - tapRef.current.lastTapTs < DOUBLE_TAP_MS;
    if (isDouble) {
      tapRef.current.aptId = null;
      tapRef.current.lastTapTs = 0;
      if (tapRef.current.pendingTimer) {
        clearTimeout(tapRef.current.pendingTimer);
        tapRef.current.pendingTimer = null;
      }
      suppressModalClickUntilRef.current = Date.now() + 450;
      requestAnimationFrame(() => setAptOptionsApt(apt));
      return true;
    }
    tapRef.current.aptId = apt.id;
    tapRef.current.lastTapTs = now;
    return false;
  }, []);

  const revertToOriginal = useCallback((original) => {
    setEvents((prev) => prev.map((ev) => (ev.id === original.id ? original : ev)));
  }, []);

  const commitMoveOrResize = useCallback(
    (apt, original) => {
      const others = events.filter((ev) => ev.id !== apt.id);
      if (wouldCauseThirdOverlap(others, apt)) {
        revertToOriginal(original);
        setOverlapAlert({
          message: "Cannot overbook. Maximum two appointments can overlap.",
        });
      }
    },
    [events, revertToOriginal],
  );

  const handleAptPointerDown = useCallback(
    (e, apt) => {
      if (e.button !== undefined && e.button !== 0) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (_) {
        /* noop */
      }
      const grid = e.currentTarget.closest(".cal-day__grid");
      const gridRect = grid ? grid.getBoundingClientRect() : null;
      const toolbarEl = document.querySelector(".cal-toolbar");
      const toolbarRect = toolbarEl ? toolbarEl.getBoundingClientRect() : null;
      dragRef.current = {
        ...dragRef.current,
        aptId: apt.id,
        pointerId: e.pointerId,
        mode: "pre",
        startY: e.clientY,
        startX: e.clientX,
        // Pointer's Y inside the grid at press time — used so the card stays
        // glued to the finger while the grid auto-scrolls during drag.
        pressYInGrid: gridRect ? e.clientY - gridRect.top : 0,
        anchorMin: minutesSinceStart(apt.start),
        anchorDur: differenceInMinutes(apt.end, apt.start),
        original: { ...apt, start: new Date(apt.start), end: new Date(apt.end) },
        gridRect,
        toolbarRect,
        cancelled: false,
      };
      dragRef.current.longPressTimer = setTimeout(() => {
        if (!dragRef.current || dragRef.current.cancelled) return;
        if (dragRef.current.mode !== "pre") return;
        dragRef.current.mode = "move";
        setDragApt(apt.id);
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([20, 30, 20]);
        }
      }, LONG_PRESS_MS);
    },
    [],
  );

  const handleResizePointerDown = useCallback(
    (e, apt) => {
      e.stopPropagation();
      if (e.button !== undefined && e.button !== 0) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (_) {
        /* noop */
      }
      const grid = e.currentTarget.closest(".cal-day__grid");
      const gridRect = grid ? grid.getBoundingClientRect() : null;
      const toolbarEl = document.querySelector(".cal-toolbar");
      const toolbarRect = toolbarEl ? toolbarEl.getBoundingClientRect() : null;
      dragRef.current = {
        ...dragRef.current,
        aptId: apt.id,
        pointerId: e.pointerId,
        mode: "resize",
        startY: e.clientY,
        startX: e.clientX,
        anchorMin: minutesSinceStart(apt.start),
        anchorDur: differenceInMinutes(apt.end, apt.start),
        original: { ...apt, start: new Date(apt.start), end: new Date(apt.end) },
        gridRect,
        toolbarRect,
        cancelled: false,
      };
      setDragApt(apt.id);
    },
    [],
  );

  const handleAptPointerMove = useCallback(
    (e, apt) => {
      const ref = dragRef.current;
      if (!ref || ref.aptId !== apt.id) return;
      if (ref.mode === "pre") {
        const dx = e.clientX - ref.startX;
        const dy = e.clientY - ref.startY;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          ref.cancelled = true;
          cancelLongPress();
        }
        return;
      }
      // Auto-scroll the calendar body so the appointment doesn't disappear
      // when dragging near the top/bottom of the visible time slots.
      const scroller = e.currentTarget.closest?.(".cal-day__scroll");
      if (scroller && typeof scroller.getBoundingClientRect === "function") {
        const r = scroller.getBoundingClientRect();
        const topEdge = r.top + AUTO_SCROLL_EDGE_PX;
        const botEdge = r.bottom - AUTO_SCROLL_EDGE_PX;
        if (e.clientY < topEdge) {
          scroller.scrollTop -= AUTO_SCROLL_STEP_PX;
        } else if (e.clientY > botEdge) {
          scroller.scrollTop += AUTO_SCROLL_STEP_PX;
        }
      }
      dragPaintSampleRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        aptId: apt.id,
        currentTarget: e.currentTarget,
      };
      if (dragPaintRafRef.current !== null) return;
      dragPaintRafRef.current = requestAnimationFrame(() => {
        dragPaintRafRef.current = null;
        const sample = dragPaintSampleRef.current;
        if (!sample) return;
        const ref2 = dragRef.current;
        if (
          !ref2 ||
          ref2.aptId !== sample.aptId ||
          (ref2.mode !== "move" && ref2.mode !== "resize")
        ) {
          return;
        }
        const { clientX, clientY, currentTarget } = sample;
        try {
          const gridEl = currentTarget.closest?.(".cal-day__grid");
          ref2.gridRect = gridEl ? gridEl.getBoundingClientRect() : ref2.gridRect;
        } catch {
          /* noop */
        }
        const grid = ref2.gridRect;
        const toolbar = ref2.toolbarRect;
        let clampedX = clientX;
        let clampedY = clientY;
        if (grid) {
          const minX = grid.left;
          const maxX = grid.right;
          const maxY = grid.bottom;
          const minY = toolbar ? toolbar.top : grid.top - 80;
          clampedX = clamp(clientX, minX, maxX);
          clampedY = clamp(clientY, minY, maxY);
        }
        const deltaX = clampedX - ref2.startX;
        if (ref2.mode === "move") {
          const yInGridNow = grid ? clampedY - grid.top : 0;
          const pressYInGrid = ref2.pressYInGrid ?? 0;
          const cardOriginalTopPx = (ref2.anchorMin / 60) * SLOT_HEIGHT;
          const maxStartPx =
            ((MINUTES_PER_DAY - ref2.anchorDur) / 60) * SLOT_HEIGHT;
          let newCardTopPx = cardOriginalTopPx + (yInGridNow - pressYInGrid);
          newCardTopPx = clamp(newCardTopPx, 0, maxStartPx);
          const newMin = (newCardTopPx / SLOT_HEIGHT) * 60;
          const snapped = snapMinutes(newMin);
          const dy = newCardTopPx - cardOriginalTopPx;
          setDragOffset({ dx: deltaX, dy });
          setDragPreviewMin(snapped);
          const previewStart = new Date(ref2.original.start);
          previewStart.setHours(DAY_START_HOUR, 0, 0, 0);
          previewStart.setMinutes(snapped);
          const overPark = grid && clampedY < grid.top - PARK_DROP_THRESHOLD;
          setParkHover(!!overPark);
          setDragTooltip({
            x: clampedX,
            y: clampedY,
            label: overPark ? "Park" : format(previewStart, "h:mm a"),
            kind: overPark ? "park" : "move",
          });
        } else if (ref2.mode === "resize") {
          const deltaY = clampedY - ref2.startY;
          const deltaMin = (deltaY / SLOT_HEIGHT) * 60;
          const newDur = clamp(
            ref2.anchorDur + deltaMin,
            5,
            MINUTES_PER_DAY - ref2.anchorMin,
          );
          const snapped = Math.max(5, snapMinutes(newDur));
          const previewEnd = addMinutes(ref2.original.start, snapped);
          const heightDelta = ((snapped - ref2.anchorDur) / 60) * SLOT_HEIGHT;
          ref2.previewSnapped = snapped;
          setResizeDelta(heightDelta);
          setDragTooltip({
            x: clampedX,
            y: clampedY,
            label: format(previewEnd, "h:mm a"),
            kind: "resize",
          });
        }
      });
    },
    [cancelLongPress],
  );

  const handleAptPointerUp = useCallback(
    (e, apt) => {
      cancelDragPaintRaf();
      const ref = dragRef.current;
      cancelLongPress();
      setDragTooltip(null);
      setDragOffset(null);
      setDragPreviewMin(null);
      setResizeDelta(0);
      setParkHover(false);
      if (!ref || ref.aptId !== apt.id) {
        finishDrag();
        return;
      }
      if (ref.mode === "pre") {
        // Tap (no drag) — double tap opens options modal; single tap does nothing.
        finishDrag();
        const opened = scheduleAppointmentOptionsDoubleTap(apt);
        if (opened) {
          try {
            if (typeof e.currentTarget.releasePointerCapture === "function") {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
          } catch {
            /* already released */
          }
        }
        return;
      }
      const original = ref.original;

      // Clamp release pointer to bounds (matches in-flight clamping)
      const grid = ref.gridRect;
      const toolbar = ref.toolbarRect;
      let clampedX = e.clientX;
      let clampedY = e.clientY;
      if (grid) {
        const minX = grid.left;
        const maxX = grid.right;
        const maxY = grid.bottom;
        const minY = toolbar ? toolbar.top : grid.top - 80;
        clampedX = clamp(e.clientX, minX, maxX);
        clampedY = clamp(e.clientY, minY, maxY);
      }

      // Park-drop check (only valid in move mode)
      if (ref.mode === "move" && grid) {
        const aboveGrid = clampedY < grid.top - PARK_DROP_THRESHOLD;
        if (aboveGrid) {
          setMoveConfirm({
            kind: "park",
            original,
            aptSnapshot: { ...apt, start: new Date(apt.start), end: new Date(apt.end) },
          });
          finishDrag();
          return;
        }
      }

      // For 'move' the card was visually transformed but state not yet mutated.
      // Compute the target time from the released (clamped) pointer Y.
      if (ref.mode === "move") {
        const yInGridNow = grid ? clampedY - grid.top : 0;
        const pressYInGrid = ref.pressYInGrid ?? 0;
        const cardOriginalTopPx = (ref.anchorMin / 60) * SLOT_HEIGHT;
        const maxStartPx =
          ((MINUTES_PER_DAY - ref.anchorDur) / 60) * SLOT_HEIGHT;
        let newCardTopPx = cardOriginalTopPx + (yInGridNow - pressYInGrid);
        newCardTopPx = clamp(newCardTopPx, 0, maxStartPx);
        const newMin = (newCardTopPx / SLOT_HEIGHT) * 60;
        const snapped = snapMinutes(newMin);
        if (snapped === ref.anchorMin) {
          // No real change — just finish silently
          finishDrag();
          return;
        }
        const newStart = new Date(original.start);
        newStart.setHours(DAY_START_HOUR, 0, 0, 0);
        newStart.setMinutes(snapped);
        const newEnd = addMinutes(newStart, ref.anchorDur);
        const candidate = { id: apt.id, start: newStart, end: newEnd };
        const others = events.filter((ev) => ev.id !== apt.id);
        if (wouldCauseThirdOverlap(others, candidate)) {
          setOverlapAlert({
            message: "Cannot overbook. Maximum two appointments can overlap.",
          });
          finishDrag();
          return;
        }
        setMoveConfirm({
          kind: "move",
          original,
          currentStart: newStart,
          currentEnd: newEnd,
        });
        finishDrag();
        return;
      }

      // Resize: state was NOT mutated during drag — compute target end now
      const snapped = ref.previewSnapped ?? ref.anchorDur;
      if (snapped === ref.anchorDur) {
        finishDrag();
        return;
      }
      const newEnd = addMinutes(original.start, snapped);
      const candidate = { id: apt.id, start: original.start, end: newEnd };
      const othersResize = events.filter((ev) => ev.id !== apt.id);
      if (wouldCauseThirdOverlap(othersResize, candidate)) {
        setOverlapAlert({
          message: "Cannot overbook. Maximum two appointments can overlap.",
        });
        finishDrag();
        return;
      }
      setMoveConfirm({
        kind: "resize",
        original,
        currentStart: original.start,
        currentEnd: newEnd,
      });
      finishDrag();
    },
    [cancelLongPress, events, finishDrag, cancelDragPaintRaf, scheduleAppointmentOptionsDoubleTap],
  );

  // Confirm-modal handlers
  const handleMoveConfirmYes = useCallback(() => {
    if (!moveConfirm) return;
    let clientName = "";
    let action = "moved";
    if (moveConfirm.kind === "park") {
      const apt = moveConfirm.aptSnapshot || moveConfirm.original;
      const aptSnapshot = {
        ...apt,
        start: new Date(apt.start),
        end: new Date(apt.end),
      };
      const durationMinutes = Math.max(5, differenceInMinutes(apt.end, apt.start) || 60);
      const parkedItem = {
        id: apt.id,
        title: apt.clientName,
        service: apt.service,
        color: "#25AFFF",
        isParked: true,
        fromMove: true,
        durationMinutes,
      };
      setEvents((prev) => prev.filter((ev) => String(ev.id) !== String(apt.id)));
      let nextParked;
      setParkedFromDrag((prev) => {
        nextParked = [...prev, parkedItem];
        persistToolbarToCalendarStorage(nextParked, toolbarEvents);
        parkedAppointmentIdsRef.current.add(String(apt.id));
        return nextParked;
      });
      setToolbarEvents((tb) => {
        queueMicrotask(() => {
          if (nextParked) void pushToolbarToServer(nextParked, tb);
        });
        return tb;
      });
      // Reset the running/completed timer for this appointment when parked —
      // keys are per appointment id (see Calendar + Screen2 timerKey).
      if (apt.id) clearTimer(String(apt.id));
      if (isAppointmentsApiAvailable() && apt.id) {
        void deleteAppointmentRemote(apt.id)
          .then(() => {
            refreshAppointmentsRef.current();
          })
          .catch((err) => {
          console.warn("[Calendar] park: API delete failed", err);
          setParkedFromDrag((prev) => prev.filter((p) => String(p.id) !== String(apt.id)));
          setEvents((prev) =>
            [...prev, aptSnapshot].sort((a, b) => a.start.getTime() - b.start.getTime()),
          );
          setOverlapAlert({
            message: `Could not park on server (${err instanceof Error ? err.message : "error"}). Appointment restored to the calendar.`,
          });
        });
      }
      clientName = apt.clientName || "";
      action = "parked";
    } else if (moveConfirm.kind === "move" || moveConfirm.kind === "resize") {
      // Apply the change now — events were untouched during drag (transform/
      // height-delta only). On Yes commit; on No nothing to revert.
      const targetId = moveConfirm.original.id;
      const nextStart = moveConfirm.currentStart;
      const nextEnd = moveConfirm.currentEnd;
      const prevSnap = {
        ...moveConfirm.original,
        start: new Date(moveConfirm.original.start),
        end: new Date(moveConfirm.original.end),
      };
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === targetId
            ? { ...ev, start: nextStart, end: nextEnd }
            : ev,
        ),
      );
      clientName = moveConfirm.original.clientName || "";
      action = moveConfirm.kind === "resize" ? "resized" : "moved";
      // Persist the new time to the backend (mirrors the edit-modal save).
      if (isAppointmentsApiAvailable() && targetId) {
        void updateAppointmentRemote(targetId, {
          start: nextStart.toISOString(),
          end: nextEnd.toISOString(),
        })
          .then(({ appointment }) => {
            setEvents((prev) =>
              prev.map((ev) =>
                ev.id === targetId ? appointmentDtoToEvent(appointment) : ev,
              ),
            );
            refreshAppointmentsRef.current();
          })
          .catch((err) => {
            console.warn("[Calendar] move/resize: API save failed", err);
            setEvents((prev) =>
              prev.map((ev) => (ev.id === prevSnap.id ? prevSnap : ev)),
            );
            setOverlapAlert({
              message: `Could not save on server (${err instanceof Error ? err.message : "error"}). Change reverted.`,
            });
          });
      }
    }
    setMoveConfirm(null);
    if (clientName) {
      setNotifyConfirm({ clientName, action });
    }
  }, [moveConfirm, clearTimer, pushToolbarToServer, toolbarEvents]);

  const handleMoveConfirmNo = useCallback(() => {
    // No state mutation happened during drag for any of move/resize/park,
    // so just dismiss the confirm. The apt naturally returns to its place
    // because dragOffset / resizeDelta are already reset in pointerUp.
    setMoveConfirm(null);
  }, []);

  const handleNotifyConfirmYes = useCallback(() => {
    // TODO: hook up real notification (SMS / push) — mock acknowledges only.
    setNotifyConfirm(null);
  }, []);

  const handleNotifyConfirmNo = useCallback(() => {
    setNotifyConfirm(null);
  }, []);

  const handleAptPointerCancel = useCallback(
    (e, apt) => {
      cancelLongPress();
      setDragTooltip(null);
      setDragOffset(null);
      setDragPreviewMin(null);
      setResizeDelta(0);
      setParkHover(false);
      tapRef.current.aptId = null;
      tapRef.current.lastTapTs = 0;
      if (tapRef.current.pendingTimer) {
        clearTimeout(tapRef.current.pendingTimer);
        tapRef.current.pendingTimer = null;
      }
      // No state to revert — both move and resize are visual-only during drag.
      finishDrag();
    },
    [cancelLongPress, finishDrag],
  );

  // ---------- Phase 4 helpers: free-slot suggestions + queued conflict apply ----------
  const computeFreeSlotsForDay = useCallback(
    (day, durationMinutes, eventsList, preferredMinutes) => {
      const dayStart = new Date(day);
      dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);

      const sameDayEvents = eventsList
        .filter((ev) => isSameDay(ev.start, day))
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      // Build free-time gaps
      const gaps = [];
      let cursor = dayStart.getTime();
      for (const ev of sameDayEvents) {
        if (ev.start.getTime() > cursor) {
          gaps.push({ start: cursor, end: ev.start.getTime() });
        }
        cursor = Math.max(cursor, ev.end.getTime());
      }
      if (cursor < dayEnd.getTime()) {
        gaps.push({ start: cursor, end: dayEnd.getTime() });
      }

      const durationMs = durationMinutes * 60 * 1000;
      const candidates = [];
      for (const g of gaps) {
        if (g.end - g.start < durationMs) continue;
        // Generate 15-min snapped candidates within the gap
        let t = g.start;
        const remainder = t % (15 * 60 * 1000);
        if (remainder !== 0) t += 15 * 60 * 1000 - remainder;
        while (t + durationMs <= g.end) {
          candidates.push(new Date(t));
          t += 30 * 60 * 1000; // 30-min step to keep list manageable
        }
      }

      // Sort by closeness to preferred time-of-day (in minutes)
      const prefMin =
        typeof preferredMinutes === "number"
          ? preferredMinutes
          : minutesSinceStart(new Date());
      candidates.sort((a, b) => {
        const am = minutesSinceStart(a);
        const bm = minutesSinceStart(b);
        return Math.abs(am - prefMin) - Math.abs(bm - prefMin);
      });
      return candidates.slice(0, 6);
    },
    [],
  );

  const applyOccurrence = useCallback(
    (occStart, occEnd, sourceApt) => {
      const newEvent = {
        id: makeEventId(),
        clientName: sourceApt.clientName,
        service: sourceApt.service,
        color: sourceApt.color,
        price: sourceApt.price ?? 0,
        notes: sourceApt.notes ?? "",
        start: occStart,
        end: occEnd,
        seriesId: sourceApt.seriesId || `series-${sourceApt.id}`,
      };
      setEvents((prev) => [...prev, newEvent]);
    },
    [],
  );

  const advanceConflictQueue = useCallback(
    (remaining) => {
      if (!remaining || remaining.length === 0) {
        setConflictItem(null);
        return;
      }
      const head = remaining[0];
      const rest = remaining.slice(1);

      const others = events; // current events at this point
      const candidate = { start: head.start, end: head.end };
      const conflicts = wouldCauseThirdOverlap(others, candidate);
      if (!conflicts) {
        applyOccurrence(head.start, head.end, head.sourceApt);
        // Process next on next tick so events state is current
        setTimeout(() => advanceConflictQueue(rest), 0);
        return;
      }

      const durationMin = differenceInMinutes(head.end, head.start);
      const suggestions = computeFreeSlotsForDay(
        head.start,
        durationMin,
        events,
        minutesSinceStart(head.start),
      );

      setConflictItem({
        current: head,
        remaining: rest,
        suggestions,
      });
    },
    [applyOccurrence, computeFreeSlotsForDay, events],
  );

  const handleRescheduleConfirm = useCallback(
    ({ weeks, count }) => {
      if (!rescheduleApt) return;
      const baseStart = rescheduleApt.start;
      const durationMin = differenceInMinutes(rescheduleApt.end, rescheduleApt.start);
      const occurrences = [];
      for (let i = 1; i <= count; i += 1) {
        const occStart = addWeeks(baseStart, weeks * i);
        const occEnd = addMinutes(occStart, durationMin);
        occurrences.push({ start: occStart, end: occEnd, sourceApt: rescheduleApt });
      }
      setRescheduleApt(null);
      // kick off queue
      setTimeout(() => advanceConflictQueue(occurrences), 0);
    },
    [advanceConflictQueue, rescheduleApt],
  );

  const handlePickConflictSlot = useCallback(
    (slot) => {
      if (!conflictItem) return;
      const { current, remaining } = conflictItem;
      const durationMin = differenceInMinutes(current.end, current.start);
      const occStart = new Date(slot);
      const occEnd = addMinutes(occStart, durationMin);
      applyOccurrence(occStart, occEnd, current.sourceApt);
      setConflictItem(null);
      setTimeout(() => advanceConflictQueue(remaining), 0);
    },
    [advanceConflictQueue, applyOccurrence, conflictItem],
  );

  const handleSkipConflict = useCallback(() => {
    if (!conflictItem) return;
    const { remaining } = conflictItem;
    setConflictItem(null);
    setTimeout(() => advanceConflictQueue(remaining), 0);
  }, [advanceConflictQueue, conflictItem]);

  // ---------- Book-from-list confirm handlers ----------
  const handleBookConfirmYes = useCallback(() => {
    if (!bookConfirm) return;
    const { kind, item, start, end } = bookConfirm;
    const dropId = item?.id != null ? String(item.id) : null;

    if (kind === "waitlist") {
      if (isAppointmentsApiAvailable()) {
        void (async () => {
          try {
            const { appointment } = await createAppointmentRemote({
              clientName: item.title,
              service: item.service || "",
              start: start.toISOString(),
              end: end.toISOString(),
              color: "#9DE684",
              price: 0,
              notes: "",
            });
            setEvents((prev) => [...prev, appointmentDtoToEvent(appointment)]);
            setToolbarEvents((prev) => prev.filter((t) => t.id !== item.id));
            setWaitlistModalOpen(false);
            refreshAppointmentsRef.current();
          } catch (err) {
            console.warn("[Calendar] waitlist book API failed", err);
            setOverlapAlert({
              message: `Could not book from waitlist (${err instanceof Error ? err.message : "error"}).`,
            });
          }
        })();
      } else {
        setEvents((prev) => [
          ...prev,
          {
            id: makeEventId(),
            clientName: item.title,
            service: item.service || "",
            color: "green",
            price: 0,
            notes: "",
            fromWaitlist: true,
            start,
            end,
          },
        ]);
        setToolbarEvents((prev) => prev.filter((t) => t.id !== item.id));
        setWaitlistModalOpen(false);
      }
    } else {
      // parked → un-park: remove from park list first, sync toolbar, then book on calendar
      let nextParked;
      let nextToolbar;
      setParkedFromDrag((prev) => {
        nextParked = dropId ? prev.filter((p) => String(p.id) !== dropId) : prev;
        return nextParked;
      });
      setToolbarEvents((prev) => {
        nextToolbar = dropId ? prev.filter((t) => String(t.id) !== dropId) : prev;
        return nextToolbar;
      });
      setParkedModalOpen(false);
      queueMicrotask(() => {
        if (nextParked && nextToolbar) {
          void pushToolbarToServer(nextParked, nextToolbar);
        }
      });

      const localEvent = {
        id: makeEventId(),
        clientName: item.title,
        service: item.service || "",
        color: item.fromMove ? "#FA1BFE" : "#8e8e93",
        price: 0,
        notes: "",
        start,
        end,
      };

      setEvents((prev) => [...prev, localEvent]);
      if (isAppointmentsApiAvailable()) {
        void (async () => {
          try {
            const { appointment } = await createAppointmentRemote({
              clientName: item.title,
              service: item.service || "",
              start: start.toISOString(),
              end: end.toISOString(),
              color: localEvent.color,
              price: 0,
              notes: "",
            });
            const saved = appointmentDtoToEvent(appointment);
            setEvents((prev) => [
              ...prev.filter((ev) => ev.id !== localEvent.id),
              saved,
            ]);
            refreshAppointmentsRef.current();
          } catch (err) {
            console.warn("[Calendar] unpark API create failed", err);
            setEvents((prev) => prev.filter((ev) => ev.id !== localEvent.id));
            setOverlapAlert({
              message: `Could not save unparked appointment (${err instanceof Error ? err.message : "error"}).`,
            });
          }
        })();
      }
    }
    setBookConfirm(null);
    if (item && item.title) {
      setNotifyConfirm({
        clientName: item.title,
        action: kind === "waitlist" ? "booked" : "scheduled",
      });
    }
  }, [bookConfirm, pushToolbarToServer]);

  const handleBookConfirmNo = useCallback(() => {
    // Just dismiss the confirm — the source list modal is still mounted
    // (just hidden via CSS) and will become visible again automatically.
    setBookConfirm(null);
  }, []);

  // ---------- Waitlist drag-to-book ----------
  const cancelWaitlistLongPress = useCallback(() => {
    if (waitlistDragRef.current.longPressTimer) {
      clearTimeout(waitlistDragRef.current.longPressTimer);
      waitlistDragRef.current.longPressTimer = null;
    }
  }, []);

  const finishWaitlistDrag = useCallback(() => {
    if (waitlistGhostRafRef.current != null) {
      cancelAnimationFrame(waitlistGhostRafRef.current);
      waitlistGhostRafRef.current = null;
    }
    waitlistGhostSampleRef.current = null;
    const pid = waitlistDragRef.current.pointerId;
    const captureEl = waitlistPointerCaptureElRef.current;
    releasePointerCaptureIfHeld(captureEl, pid);
    waitlistPointerCaptureElRef.current = null;
    setWaitlistDrag(null);
    waitlistDragRef.current = {
      itemId: null,
      pointerId: null,
      startX: 0,
      startY: 0,
      longPressTimer: null,
      activated: false,
      dayGridRect: null,
    };
  }, []);

  const handleWaitlistPointerDown = useCallback(
    (e, item) => {
      if (viewMode !== "day") return;
      if (e.button !== undefined && e.button !== 0) return;
      const gridProbe = document.querySelector(".cal-day__grid");
      if (!gridProbe) return;
      waitlistPointerCaptureElRef.current = e.currentTarget;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (_) {
        /* noop */
      }
      waitlistDragRef.current = {
        itemId: item.id,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        longPressTimer: null,
        activated: false,
        dayGridRect: null,
      };
      waitlistDragRef.current.longPressTimer = setTimeout(() => {
        if (!waitlistDragRef.current || waitlistDragRef.current.itemId !== item.id) return;
        const grid = document.querySelector(".cal-day__grid");
        if (!grid) {
          cancelWaitlistLongPress();
          finishWaitlistDrag();
          return;
        }
        waitlistDragRef.current.activated = true;
        waitlistDragRef.current.dayGridRect = grid.getBoundingClientRect();
        setWaitlistDrag({
          item,
          x: waitlistDragRef.current.startX,
          y: waitlistDragRef.current.startY,
        });
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(15);
        }
      }, 200);
    },
    [viewMode, cancelWaitlistLongPress, finishWaitlistDrag],
  );

  const handleWaitlistPointerMove = useCallback(
    (e, item) => {
      const ref = waitlistDragRef.current;
      if (!ref || ref.itemId !== item.id) return;
      if (!ref.activated) {
        const dx = e.clientX - ref.startX;
        const dy = e.clientY - ref.startY;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          cancelWaitlistLongPress();
          finishWaitlistDrag();
        }
        return;
      }
      waitlistGhostSampleRef.current = { x: e.clientX, y: e.clientY };
      if (waitlistGhostRafRef.current !== null) return;
      waitlistGhostRafRef.current = requestAnimationFrame(() => {
        waitlistGhostRafRef.current = null;
        const xy = waitlistGhostSampleRef.current;
        if (!xy) return;
        const inner = waitlistDragRef.current;
        if (!inner.activated || inner.itemId !== item.id) return;
        setWaitlistDrag((prev) => (prev ? { ...prev, ...xy } : prev));
      });
    },
    [cancelWaitlistLongPress, finishWaitlistDrag],
  );

  const handleWaitlistPointerUp = useCallback(
    (e, item) => {
      const ref = waitlistDragRef.current;
      cancelWaitlistLongPress();
      if (!ref || ref.itemId !== item.id) {
        finishWaitlistDrag();
        return;
      }
      if (!ref.activated) {
        finishWaitlistDrag();
        return;
      }
      const grid = ref.dayGridRect;
      if (!grid) {
        finishWaitlistDrag();
        return;
      }
      // Drop ANYWHERE — clamp the pointer Y into the grid range so we always
      // produce a valid time slot, even if user released above/below/outside.
      const clampedY = clamp(e.clientY, grid.top, grid.bottom);
      const yInGrid = clampedY - grid.top;
      // Waitlist booking is 60 minutes — ensure the *end* never goes past 10:00 PM.
      const totalMin = clamp((yInGrid / SLOT_HEIGHT) * 60, 0, MINUTES_PER_DAY - 60);
      const snapped = snapMinutes(totalMin);
      const start = new Date(currentDate);
      start.setHours(DAY_START_HOUR, 0, 0, 0);
      start.setMinutes(snapped);
      const end = addMinutes(start, 60);
      const candidate = { start, end };
      if (wouldCauseThirdOverlap(events, candidate)) {
        setOverlapAlert({
          message: "Cannot overbook. Maximum two appointments can overlap.",
        });
        finishWaitlistDrag();
        return;
      }
      // Don't book yet — show confirmation first
      setBookConfirm({
        kind: "waitlist",
        item,
        start,
        end,
      });
      finishWaitlistDrag();
    },
    [cancelWaitlistLongPress, currentDate, events, finishWaitlistDrag],
  );

  const handleWaitlistPointerCancel = useCallback(
    (e, item) => {
      const ref = waitlistDragRef.current;
      cancelWaitlistLongPress();
      if (ref && ref.itemId === item.id) {
        finishWaitlistDrag();
      }
    },
    [cancelWaitlistLongPress, finishWaitlistDrag],
  );

  // Parked drag (mirrors waitlist flow but un-parks back into events)
  const cancelParkedLongPress = useCallback(() => {
    if (parkedDragRef.current.longPressTimer) {
      clearTimeout(parkedDragRef.current.longPressTimer);
      parkedDragRef.current.longPressTimer = null;
    }
  }, []);

  const finishParkedDrag = useCallback(() => {
    if (parkedGhostRafRef.current != null) {
      cancelAnimationFrame(parkedGhostRafRef.current);
      parkedGhostRafRef.current = null;
    }
    parkedGhostSampleRef.current = null;
    const pid = parkedDragRef.current.pointerId;
    const captureEl = parkedPointerCaptureElRef.current;
    releasePointerCaptureIfHeld(captureEl, pid);
    parkedPointerCaptureElRef.current = null;
    setParkedDrag(null);
    parkedDragRef.current = {
      itemId: null,
      pointerId: null,
      startX: 0,
      startY: 0,
      longPressTimer: null,
      activated: false,
      dayGridRect: null,
    };
  }, []);

  const removeFromParked = useCallback((id) => {
    setToolbarEvents((prev) => prev.filter((t) => t.id !== id));
    setParkedFromDrag((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleParkedPointerDown = useCallback(
    (e, item) => {
      if (viewMode !== "day") return;
      if (e.button !== undefined && e.button !== 0) return;
      const gridProbe = document.querySelector(".cal-day__grid");
      if (!gridProbe) return;
      parkedPointerCaptureElRef.current = e.currentTarget;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (_) {
        /* noop */
      }
      parkedDragRef.current = {
        itemId: item.id,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        longPressTimer: null,
        activated: false,
        dayGridRect: null,
      };
      parkedDragRef.current.longPressTimer = setTimeout(() => {
        if (!parkedDragRef.current || parkedDragRef.current.itemId !== item.id) return;
        const grid = document.querySelector(".cal-day__grid");
        if (!grid) {
          cancelParkedLongPress();
          finishParkedDrag();
          return;
        }
        parkedDragRef.current.activated = true;
        parkedDragRef.current.dayGridRect = grid.getBoundingClientRect();
        setParkedDrag({
          item,
          x: parkedDragRef.current.startX,
          y: parkedDragRef.current.startY,
        });
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(15);
        }
      }, 200);
    },
    [viewMode, cancelParkedLongPress, finishParkedDrag],
  );

  const handleParkedPointerMove = useCallback(
    (e, item) => {
      const ref = parkedDragRef.current;
      if (!ref || ref.itemId !== item.id) return;
      if (!ref.activated) {
        const dx = e.clientX - ref.startX;
        const dy = e.clientY - ref.startY;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          cancelParkedLongPress();
          finishParkedDrag();
        }
        return;
      }
      parkedGhostSampleRef.current = { x: e.clientX, y: e.clientY };
      if (parkedGhostRafRef.current !== null) return;
      parkedGhostRafRef.current = requestAnimationFrame(() => {
        parkedGhostRafRef.current = null;
        const xy = parkedGhostSampleRef.current;
        if (!xy) return;
        const inner = parkedDragRef.current;
        if (!inner.activated || inner.itemId !== item.id) return;
        setParkedDrag((prev) => (prev ? { ...prev, ...xy } : prev));
      });
    },
    [cancelParkedLongPress, finishParkedDrag],
  );

  const handleParkedPointerUp = useCallback(
    (e, item) => {
      const ref = parkedDragRef.current;
      cancelParkedLongPress();
      if (!ref || ref.itemId !== item.id || !ref.activated) {
        finishParkedDrag();
        return;
      }
      const grid = ref.dayGridRect;
      if (!grid) {
        finishParkedDrag();
        return;
      }
      const insideGrid =
        e.clientY >= grid.top &&
        e.clientY <= grid.bottom &&
        e.clientX >= grid.left &&
        e.clientX <= grid.right;
      if (!insideGrid) {
        finishParkedDrag();
        return;
      }
      const yInGrid = e.clientY - grid.top;
      const durationMinutes = Math.max(5, Number(item.durationMinutes) || 60);
      // Parked drop duration varies — ensure the *end* never goes past 10:00 PM.
      const totalMin = clamp((yInGrid / SLOT_HEIGHT) * 60, 0, MINUTES_PER_DAY - durationMinutes);
      const snapped = snapMinutes(totalMin);
      const start = new Date(currentDate);
      start.setHours(DAY_START_HOUR, 0, 0, 0);
      start.setMinutes(snapped);
      const end = addMinutes(start, durationMinutes);
      const candidate = { start, end };
      if (wouldCauseThirdOverlap(events, candidate)) {
        setOverlapAlert({
          message: "Cannot overbook. Maximum two appointments can overlap.",
        });
        finishParkedDrag();
        return;
      }
      // Don't book yet — show confirmation first
      setBookConfirm({
        kind: "parked",
        item,
        start,
        end,
      });
      finishParkedDrag();
    },
    [cancelParkedLongPress, currentDate, events, finishParkedDrag],
  );

  const handleParkedPointerCancel = useCallback(
    (e, item) => {
      const ref = parkedDragRef.current;
      cancelParkedLongPress();
      if (ref && ref.itemId === item.id) {
        finishParkedDrag();
      }
    },
    [cancelParkedLongPress, finishParkedDrag],
  );

  // Live time tick — every 30 seconds
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  // API mode: persist toolbar locally; appointments live on server + session cache only.
  useEffect(() => {
    if (!isAppointmentsApiAvailable()) return;
    const timer = setTimeout(() => {
      if (shouldSkipServerPersist()) return;
      persistCalendar(
        { clients, serviceCatalog, parkedFromDrag, toolbarEvents },
        { skipEvents: true },
      );
      if (calendarToolbarRemoteReady) {
        void saveCalendarToolbarRemote({
            parkedFromDrag,
            toolbarEvents,
            ...(toolbarUpdatedAtRef.current
              ? { expectedUpdatedAt: toolbarUpdatedAtRef.current }
              : {}),
          })
            .then((data) => {
              if (data?.updatedAt) toolbarUpdatedAtRef.current = data.updatedAt;
            })
            .catch((err) => {
              if (err?.code === "CONFLICT" && err.payload) {
                pauseServerPersist();
                const revived = reviveCalendarSlices({
                  parkedFromDrag: err.payload.parkedFromDrag,
                  toolbarEvents: err.payload.toolbarEvents,
                });
                setParkedFromDrag(
                  Array.isArray(revived.parkedFromDrag) ? revived.parkedFromDrag : [],
                );
                setToolbarEvents(
                  Array.isArray(revived.toolbarEvents) ? revived.toolbarEvents : [],
                );
                if (err.payload.updatedAt) {
                  toolbarUpdatedAtRef.current = err.payload.updatedAt;
                }
                return;
              }
              console.warn("[Calendar] toolbar backend sync failed", err);
            });
      }
      if (calendarCatalogRemoteReady) {
        if (clients.length > 0) {
          void saveClientsCatalogRemote({
            clients,
            ...(clientsCatalogUpdatedAtRef.current
              ? { expectedUpdatedAt: clientsCatalogUpdatedAtRef.current }
              : {}),
          })
            .then((data) => {
              if (data?.updatedAt) clientsCatalogUpdatedAtRef.current = data.updatedAt;
            })
            .catch((err) => {
              if (err?.code === "CONFLICT" && err.payload?.clients) {
                pauseServerPersist();
                setClients(
                  Array.isArray(err.payload.clients) ? err.payload.clients : [],
                );
                if (err.payload.updatedAt) {
                  clientsCatalogUpdatedAtRef.current = err.payload.updatedAt;
                }
                return;
              }
              console.warn("[Calendar] clients catalog sync failed", err);
            });
        }
        if (serviceCatalog.length > 0) {
          void saveServiceCatalogRemote({
            serviceCatalog,
            ...(serviceCatalogUpdatedAtRef.current
              ? { expectedUpdatedAt: serviceCatalogUpdatedAtRef.current }
              : {}),
          })
            .then((data) => {
              if (data?.updatedAt) serviceCatalogUpdatedAtRef.current = data.updatedAt;
            })
            .catch((err) => {
              if (err?.code === "CONFLICT" && err.payload?.serviceCatalog) {
                pauseServerPersist();
                setServiceCatalog(
                  Array.isArray(err.payload.serviceCatalog)
                    ? err.payload.serviceCatalog
                    : [],
                );
                if (err.payload.updatedAt) {
                  serviceCatalogUpdatedAtRef.current = err.payload.updatedAt;
                }
                return;
              }
              console.warn("[Calendar] service catalog sync failed", err);
            });
        }
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [
    clients,
    serviceCatalog,
    parkedFromDrag,
    toolbarEvents,
    calendarToolbarRemoteReady,
    calendarCatalogRemoteReady,
    pauseServerPersist,
    shouldSkipServerPersist,
  ]);

  // Offline / no API: persist full calendar slice including appointments.
  useEffect(() => {
    if (isAppointmentsApiAvailable()) return;
    const timer = setTimeout(() => {
      persistCalendar({ events, clients, serviceCatalog, parkedFromDrag, toolbarEvents });
    }, 150);
    return () => clearTimeout(timer);
  }, [events, clients, serviceCatalog, parkedFromDrag, toolbarEvents]);

  // Load parked + waitlist from backend (`/api/calendar-toolbar` → DB).
  useEffect(() => {
    if (!isAppointmentsApiAvailable()) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchCalendarToolbar();
        if (cancelled) return;
        pauseServerPersist();

        const persistedNav = readPersistedCalendarBack();
        const rebookIntent =
          location?.state?.rebookToPark &&
          typeof location.state.rebookToPark === "object"
            ? {
                item: location.state.rebookToPark,
                goToDate:
                  typeof location?.state?.goToDate === "string"
                    ? location.state.goToDate
                    : null,
              }
            : persistedNav?.rebookToPark && typeof persistedNav.rebookToPark === "object"
              ? {
                  item: persistedNav.rebookToPark,
                  goToDate:
                    typeof persistedNav.goToDate === "string"
                      ? persistedNav.goToDate
                      : null,
                }
              : null;

        let nextParked = [];
        let nextToolbar = [];
        let hadMocks = false;

        if (data?.stored) {
          const revived = reviveCalendarSlices({
            parkedFromDrag: data.parkedFromDrag,
            toolbarEvents: data.toolbarEvents,
          });
          nextParked = Array.isArray(revived.parkedFromDrag)
            ? revived.parkedFromDrag
            : [];
          nextToolbar = Array.isArray(revived.toolbarEvents)
            ? revived.toolbarEvents
            : [];
          hadMocks = toolbarHadLegacyMockEntries(
            data.parkedFromDrag,
            data.toolbarEvents,
          );
          if (data.updatedAt) toolbarUpdatedAtRef.current = data.updatedAt;
        }

        let shouldPushToolbar = hadMocks;
        if (rebookIntent?.item && !rebookParkHandledRef.current) {
          rebookParkHandledRef.current = true;
          const beforeLen = nextParked.length;
          nextParked = mergeRebookParkItem(nextParked, rebookIntent.item);
          shouldPushToolbar = shouldPushToolbar || nextParked.length > beforeLen;

          setViewMode("day");
          setCurrentDate(startOfDay(new Date()));
          setMonthSheetDate(null);
          setNewApptInit(null);
          setNewApptSeedClient(null);
          setEmptySlotInfo(null);

          if (rebookIntent.item.sourceAppointmentId) {
            purgeSourceForParkRef.current?.(rebookIntent.item.sourceAppointmentId, {
              parkItemId: rebookIntent.item.id,
            });
          }
          if (rebookIntent.item?.id != null) {
            parkedAppointmentIdsRef.current.add(String(rebookIntent.item.id));
          }

          writePersistedCalendarBack(calendarBackTarget);
          clearPersistedCalendarNavIntents();
        }

        setParkedFromDrag(nextParked);
        setToolbarEvents(nextToolbar);
        persistToolbarToCalendarStorage(nextParked, nextToolbar);

        if (shouldPushToolbar) {
          pauseServerPersist(800);
          queueMicrotask(() => {
            void saveCalendarToolbarRemote({
              parkedFromDrag: nextParked,
              toolbarEvents: nextToolbar,
              ...(toolbarUpdatedAtRef.current
                ? { expectedUpdatedAt: toolbarUpdatedAtRef.current }
                : {}),
            })
              .then((saved) => {
                if (saved?.updatedAt) toolbarUpdatedAtRef.current = saved.updatedAt;
              })
              .catch((err) => {
                console.warn("[Calendar] toolbar hydrate push failed", err);
              });
          });
        }
      } catch (err) {
        console.warn("[Calendar] toolbar load from API failed", err);
      } finally {
        if (!cancelled) setCalendarToolbarRemoteReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    pauseServerPersist,
    calendarBackTarget,
    location.key,
    location?.state?.rebookToPark,
    location?.state?.goToDate,
  ]);

  // Load clients + service catalog from backend.
  useEffect(() => {
    if (!isAppointmentsApiAvailable()) return;
    let cancelled = false;
    void (async () => {
      try {
        const [clientsData, servicesData] = await Promise.all([
          fetchClientsCatalog(),
          fetchServiceCatalog(),
        ]);
        if (cancelled) return;
        if (clientsData?.stored && Array.isArray(clientsData.clients)) {
          pauseServerPersist();
          setClients(clientsData.clients);
          if (clientsData.updatedAt) {
            clientsCatalogUpdatedAtRef.current = clientsData.updatedAt;
          }
        }
        if (servicesData?.stored && Array.isArray(servicesData.serviceCatalog)) {
          pauseServerPersist();
          setServiceCatalog(servicesData.serviceCatalog);
          if (servicesData.updatedAt) {
            serviceCatalogUpdatedAtRef.current = servicesData.updatedAt;
          }
        }
      } catch (err) {
        console.warn("[Calendar] catalog load from API failed", err);
      } finally {
        if (!cancelled) setCalendarCatalogRemoteReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pauseServerPersist]);

  const mergeServerAppointmentRows = useCallback((serverRows, prev) => {
    const parkedIds = parkedAppointmentIdsRef.current;
    const server = serverRows
      .map(appointmentDtoToEvent)
      .filter((e) => !parkedIds.has(String(e.id)));
    const serverIds = new Set(server.map((e) => String(e.id)));
    const extras = prev.filter(
      (e) => !serverIds.has(String(e.id)) && !parkedIds.has(String(e.id)),
    );
    return [...server, ...extras].sort((a, b) => a.start.getTime() - b.start.getTime());
  }, []);

  const refetchAppointmentsFromServer = useCallback(async (opts = {}) => {
    const { replace = false, background = false } = opts;
    const { from, to } = mockAppointmentFetchRange();
    if (!isAppointmentsApiAvailable()) return;
    if (!background) {
      appointmentsFetchAbortRef.current?.abort();
    }
    const ac = new AbortController();
    if (!background) {
      appointmentsFetchAbortRef.current = ac;
    }
    const myToken = ++appointmentsListFetchTokenRef.current;

    const applyMockFallback = () => {
      if (!shouldUseMockAppointmentFallback()) return false;
      const mockEvents = buildMockAppointmentsForRange(from, to);
      setEvents(mockEvents);
      queueMicrotask(() => {
        appointmentsInitialFetchDoneRef.current = true;
        writeApiAppointmentsSessionCache(mockEvents);
      });
      return true;
    };

    try {
      const rows = await fetchAppointmentsRange(from, to, { signal: ac.signal });
      if (ac.signal.aborted) return;
      if (myToken !== appointmentsListFetchTokenRef.current) return;
      if (!rows.length && applyMockFallback()) return;
      setEvents((prev) => {
        const parkedIds = parkedAppointmentIdsRef.current;
        const filterParked = (list) =>
          list.filter((e) => !parkedIds.has(String(e.id)));
        const next = replace
          ? filterParked(rows.map(appointmentDtoToEvent)).sort(
              (a, b) => a.start.getTime() - b.start.getTime(),
            )
          : mergeServerAppointmentRows(rows, prev);
        queueMicrotask(() => {
          appointmentsInitialFetchDoneRef.current = true;
          writeApiAppointmentsSessionCache(filterParked(next));
        });
        return next;
      });
    } catch (err) {
      if (err?.name === "AbortError" || err?.code === 20) return;
      console.warn("[Calendar] appointments API load failed", err);
      if (myToken !== appointmentsListFetchTokenRef.current) return;
      applyMockFallback();
    } finally {
      appointmentsInitialFetchDoneRef.current = true;
    }
  }, [mergeServerAppointmentRows]);

  refreshAppointmentsRef.current = () =>
    refetchAppointmentsFromServer({ replace: false, background: true });

  const purgeSourceAppointmentForPark = useCallback(
    (sourceId, { parkItemId } = {}) => {
      if (!sourceId) return;
      const id = String(sourceId);
      parkedAppointmentIdsRef.current.add(id);
      setEvents((prev) => prev.filter((e) => String(e.id) !== id));
      removeAppointmentFromSessionCache(id);
      notifyCalendarUpdated();
      clearTimer(id);
      if (!isAppointmentsApiAvailable()) return;
      void deleteAppointmentRemote(id)
        .then(() => refreshAppointmentsRef.current())
        .catch((err) => {
          console.warn("[Calendar] park source delete failed", err);
          if (parkItemId) {
            setParkedFromDrag((prev) =>
              prev.filter((p) => String(p.id) !== String(parkItemId)),
            );
          }
        });
    },
    [clearTimer],
  );
  purgeSourceForParkRef.current = purgeSourceAppointmentForPark;

  useEffect(() => {
    if (!isAppointmentsApiAvailable()) return;
    void refetchAppointmentsFromServer({
      replace: true,
      background: !isBrowserReloadNavigation(),
    });
    return () => {
      appointmentsFetchAbortRef.current?.abort();
    };
  }, [refetchAppointmentsFromServer]);

  const applyRemoteToolbarPayload = useCallback(
    (payload) => {
      if (!payload?.stored) return;
      pauseServerPersist();
      const revived = reviveCalendarSlices({
        parkedFromDrag: payload.parkedFromDrag,
        toolbarEvents: payload.toolbarEvents,
      });
      const nextParkedFromServer = Array.isArray(revived.parkedFromDrag)
        ? revived.parkedFromDrag
        : [];
      const nextToolbar = Array.isArray(revived.toolbarEvents)
        ? revived.toolbarEvents
        : [];
      setParkedFromDrag((prev) => {
        const merged = mergeParkedToolbarRows(nextParkedFromServer, prev);
        persistToolbarToCalendarStorage(merged, nextToolbar);
        return merged;
      });
      setToolbarEvents(nextToolbar);
      if (payload.updatedAt) toolbarUpdatedAtRef.current = payload.updatedAt;
    },
    [pauseServerPersist],
  );

  const reloadToolbarFromServer = useCallback(async () => {
    pauseServerPersist();
    try {
      const data = await fetchCalendarToolbar();
      if (data?.stored) applyRemoteToolbarPayload(data);
    } catch {
      /* */
    }
  }, [applyRemoteToolbarPayload, pauseServerPersist]);

  const applyRemoteAppointmentDto = useCallback((dto) => {
    if (!dto || typeof dto !== "object") return;
    const ev = appointmentDtoToEvent(dto);
    if (!(ev.start instanceof Date) || !(ev.end instanceof Date)) return;
    if (parkedAppointmentIdsRef.current.has(String(ev.id))) return;
    setEvents((prev) =>
      [...prev.filter((e) => String(e.id) !== String(ev.id)), ev].sort(
        (a, b) => a.start.getTime() - b.start.getTime(),
      ),
    );
    upsertAppointmentInSessionCache(dto);
  }, []);

  const removeRemoteAppointment = useCallback((id) => {
    if (!id) return;
    setEvents((prev) => prev.filter((e) => String(e.id) !== String(id)));
    removeAppointmentFromSessionCache(id);
  }, []);

  useEffect(() => {
    if (!isAppointmentsApiAvailable()) return;
    return startCalendarRealtimeSync({
      onAppointmentCreated: (p) => applyRemoteAppointmentDto(p?.appointment),
      onAppointmentUpdated: (p) => applyRemoteAppointmentDto(p?.appointment),
      onAppointmentDeleted: (p) => removeRemoteAppointment(p?.id),
      onToolbarUpdated: applyRemoteToolbarPayload,
      onClientsCatalogUpdated: (payload) => {
        if (payload?.stored && Array.isArray(payload.clients)) {
          pauseServerPersist();
          setClients(payload.clients);
          if (payload.updatedAt) {
            clientsCatalogUpdatedAtRef.current = payload.updatedAt;
          }
        }
      },
      onServiceCatalogUpdated: (payload) => {
        if (payload?.stored && Array.isArray(payload.serviceCatalog)) {
          pauseServerPersist();
          setServiceCatalog(payload.serviceCatalog);
          if (payload.updatedAt) {
            serviceCatalogUpdatedAtRef.current = payload.updatedAt;
          }
        }
      },
      onPoll: () => {
        void reloadToolbarFromServer();
        void refetchAppointmentsFromServer({ replace: true, background: true });
      },
    });
  }, [
    applyRemoteAppointmentDto,
    removeRemoteAppointment,
    applyRemoteToolbarPayload,
    reloadToolbarFromServer,
    refetchAppointmentsFromServer,
    pauseServerPersist,
  ]);

  const parked = useMemo(
    () => [...toolbarEvents.filter((e) => e.isParked === true), ...parkedFromDrag],
    [toolbarEvents, parkedFromDrag],
  );

  /** Appointment ids in the park toolbar — hidden from the day/week/month grid. */
  const parkedAppointmentIds = useMemo(() => {
    const ids = new Set();
    for (const p of parkedFromDrag) {
      if (p?.id != null) ids.add(String(p.id));
      if (p?.sourceAppointmentId != null) ids.add(String(p.sourceAppointmentId));
    }
    for (const t of toolbarEvents) {
      if (t?.isParked === true && t?.id != null) ids.add(String(t.id));
    }
    parkedAppointmentIdsRef.current = ids;
    return ids;
  }, [parkedFromDrag, toolbarEvents]);

  const calendarEvents = useMemo(
    () => events.filter((e) => !parkedAppointmentIds.has(String(e.id))),
    [events, parkedAppointmentIds],
  );

  // Persist API-backed events for the current local day so Stylist / ClientList still
  // see today's list while Calendar is unmounted (session cache + loadCalendarEvents fallback).
  useEffect(() => {
    if (!isAppointmentsApiAvailable()) return;
    if (!appointmentsInitialFetchDoneRef.current && calendarEvents.length === 0) return;
    const t = setTimeout(() => {
      writeApiAppointmentsSessionCache(calendarEvents);
    }, 400);
    return () => clearTimeout(t);
  }, [calendarEvents]);

  useEffect(() => {
    if (isAppointmentsApiAvailable()) {
      setApiModeCalendarEventsMirror(calendarEvents);
      notifyCalendarUpdated();
    } else {
      setApiModeCalendarEventsMirror(null);
    }
  }, [calendarEvents]);

  const waitlist = useMemo(
    () =>
      toolbarEvents
        .filter((e) => !e.isParked && e.waitlistAddedAt)
        .sort((a, b) => new Date(a.waitlistAddedAt).getTime() - new Date(b.waitlistAddedAt).getTime()),
    [toolbarEvents],
  );

  const weekDates = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const fiveDayDates = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(currentDate, i)),
    [currentDate]
  );

  const dayAppointments = useMemo(
    () => calendarEvents.filter((a) => isSameDay(a.start, currentDate)),
    [calendarEvents, currentDate]
  );

  const positioned = useMemo(() => layoutDayAppointments(dayAppointments), [dayAppointments]);

  // Known clients lookup — used to flag "new client" appointments (phone/name
  // not yet in the owner's records). Boss spec: small blue dot indicator.
  const knownClientNames = useMemo(() => {
    const set = new Set();
    for (const c of clients) {
      const n = (c.name || "").trim().toLowerCase();
      if (n) set.add(n);
    }
    return set;
  }, [clients]);

  const hours = useMemo(
    () => Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i),
    []
  );

  // Compute the 6×7 week grid for any month (used to render every block in the
  // continuously-scrolling Month view).
  const monthWeeksFor = useCallback((monthDate) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const start = startOfWeek(monthStart, { weekStartsOn: 0 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
    return weeks;
  }, []);

  // Apple Calendar-style "infinite" month list — render a fixed window of
  // months (today − 12 to today + 12) stacked vertically. The user scrolls
  // up/down to traverse months instead of swiping horizontally. Anchored to
  // today's month so day taps don't shift the window or jump scroll.
  const monthWindow = useMemo(() => {
    const anchor = startOfMonth(new Date());
    const list = [];
    for (let i = -12; i <= 12; i += 1) list.push(addMonths(anchor, i));
    return list;
  }, []);

  const monthSheetAppointments = useMemo(() => {
    if (!monthSheetDate) return [];
    const list = calendarEvents.filter((a) => isSameDay(a.start, monthSheetDate));
    list.sort((a, b) => a.start - b.start);
    return list;
  }, [calendarEvents, monthSheetDate]);

  useEffect(() => {
    if (viewMode !== "month") setMonthSheetDate(null);
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== "day") {
      cancelWaitlistLongPress();
      cancelParkedLongPress();
      finishWaitlistDrag();
      finishParkedDrag();
    }
  }, [viewMode, cancelWaitlistLongPress, cancelParkedLongPress, finishWaitlistDrag, finishParkedDrag]);

  /* Safety-net: when a global pointerup / pointercancel fires while a
     waitlist or parked ghost is in flight, give the source element's
     own handler one frame to run, then if the drag ref is still flagged
     as in-flight, clean up. This rescues the rare case where Safari
     drops the captured `pointerup` mid-drag (DOM/style change) and the
     ghost would otherwise remain stuck on screen. */
  useEffect(() => {
    if (!waitlistDrag && !parkedDrag) return;
    let raf = 0;
    const onGlobalUp = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (waitlistDragRef.current.itemId != null) {
          finishWaitlistDrag();
        }
        if (parkedDragRef.current.itemId != null) {
          finishParkedDrag();
        }
      });
    };
    window.addEventListener("pointerup", onGlobalUp);
    window.addEventListener("pointercancel", onGlobalUp);
    return () => {
      window.removeEventListener("pointerup", onGlobalUp);
      window.removeEventListener("pointercancel", onGlobalUp);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [waitlistDrag, parkedDrag, finishWaitlistDrag, finishParkedDrag]);

  // Live time line — only render when viewing today (Day view)
  const liveTimeLineMin = useMemo(() => {
    if (!isToday(currentDate)) return null;
    const m = minutesSinceStart(now);
    if (m < 0 || m > MINUTES_PER_DAY) return null;
    return m;
  }, [currentDate, now]);

  // Click empty slot in grid → action modal. Day param is optional and lets
  // the 5-day grid pass the column's specific date.
  const handleGridClick = useCallback(
    (e, day) => {
      // 5-day view: tap any slot → jump to Day view for that date (no creation here)
      if (viewMode === "week") {
        if (day) setCurrentDate(day);
        setViewMode("day");
        return;
      }
      // Only react to direct grid clicks (not on appointment buttons / time line)
      if (e.target.closest(".cal-apt") || e.target.closest(".cal-now")) return;
      const grid = e.currentTarget;
      const rect = grid.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const totalMinutes = clamp((y / SLOT_HEIGHT) * 60, 0, MINUTES_PER_DAY);
      const snapped = snapMinutes(totalMinutes);
      const hour = DAY_START_HOUR + Math.floor(snapped / 60);
      const minute = snapped % 60;
      setEmptySlotInfo({ date: day || currentDate, hour, minute });
    },
    [currentDate, viewMode]
  );

  const openNewAppointmentAt = useCallback((date, hour, minute) => {
    const start = new Date(date);
    start.setHours(hour, minute, 0, 0);
    setEmptySlotInfo(null);
    setEditingApt(null);
    setNewApptInit(start);
  }, []);

  const goToDayForScheduling = useCallback(
    (d) => {
      resetSwipeNav();
      setCurrentDate(d);
      setMonthSheetDate(null);
      setViewMode("day");
      if (bookFutureCtx.active && bookFutureCtx.seedClientName) {
        setNewApptSeedClient(bookFutureCtx.seedClientName);
        openNewAppointmentAt(d, FUTURE_BOOK_DEFAULT_HOUR, FUTURE_BOOK_DEFAULT_MINUTE);
      }
    },
    [bookFutureCtx.active, bookFutureCtx.seedClientName, openNewAppointmentAt],
  );

  const handleHeaderPlus = useCallback(() => {
    // Default to current hour rounded down + 0 minutes, or 9:00 AM if not today
    const base = new Date(currentDate);
    if (isToday(currentDate)) {
      base.setMinutes(0, 0, 0);
    } else {
      base.setHours(9, 0, 0, 0);
    }
    setEditingApt(null);
    setNewApptInit(base);
  }, [currentDate]);

  const monthScrollElRef = useRef(null);

  const scrollMonthScrollToToday = useCallback((el) => {
    if (!el) return;
    const today = new Date();
    const targetIso = startOfMonth(today).toISOString();
    const block = el.querySelector(`[data-month="${targetIso}"]`);
    if (!block) return;
    const blockRect = block.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    el.scrollTop = el.scrollTop + (blockRect.top - elRect.top);
  }, []);

  // Swipe "slider" animation for Day / 5-Day views
  const [swipeAnim, setSwipeAnim] = useState(
    /** @type {null | { dir: 'prev' | 'next'; from: Date; to: Date; translatePct: number }} */ (null)
  );
  const swipeCompleteTimeoutRef = useRef(null);
  const swipeAnimRef = useRef(null);
  /** Synchronous guard: pointerup + touchend can fire same tick before swipe state commits. */
  const swipeNavPendingRef = useRef(false);

  const finishSwipeNav = useCallback(() => {
    const anim = swipeAnimRef.current;
    if (!anim) return;
    swipeNavPendingRef.current = false;
    if (swipeCompleteTimeoutRef.current != null) {
      clearTimeout(swipeCompleteTimeoutRef.current);
      swipeCompleteTimeoutRef.current = null;
    }
    setCurrentDate(anim.to);
    setSwipeAnim(null);
  }, []);

  const resetSwipeNav = useCallback(() => {
    swipeNavPendingRef.current = false;
    if (swipeCompleteTimeoutRef.current != null) {
      clearTimeout(swipeCompleteTimeoutRef.current);
      swipeCompleteTimeoutRef.current = null;
    }
    setSwipeAnim(null);
  }, []);

  const scheduleSwipeCompleteFallback = useCallback(() => {
    if (swipeCompleteTimeoutRef.current != null) {
      clearTimeout(swipeCompleteTimeoutRef.current);
    }
    swipeCompleteTimeoutRef.current = window.setTimeout(() => {
      swipeCompleteTimeoutRef.current = null;
      finishSwipeNav();
    }, 400);
  }, [finishSwipeNav]);

  const handleSwipeTransitionEnd = useCallback((e) => {
    if (e.propertyName !== "transform") return;
    if (e.target !== e.currentTarget) return;
    finishSwipeNav();
  }, [finishSwipeNav]);

  useEffect(
    () => () => {
      if (swipeCompleteTimeoutRef.current != null) {
        clearTimeout(swipeCompleteTimeoutRef.current);
      }
    },
    [],
  );

  const handleGoToToday = useCallback(() => {
    resetSwipeNav();
    const t = new Date();
    const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    setCurrentDate(today);
    setMonthSheetDate(null);
    setViewMode("day");
    requestAnimationFrame(() => {
      scrollMonthScrollToToday(monthScrollElRef.current);
      requestAnimationFrame(() => scrollMonthScrollToToday(monthScrollElRef.current));
    });
  }, [resetSwipeNav, scrollMonthScrollToToday]);

  useEffect(() => {
    resetSwipeNav();
  }, [viewMode, resetSwipeNav]);

  const beginSwipeNav = useCallback(
    (dir) => {
      // Month body is outside the day/week swipe slider — jump by month without swipeAnim.
      if (viewMode === "month") {
        const delta = dir === "prev" ? -1 : 1;
        setCurrentDate((prev) => addMonths(prev, delta));
        setMonthSheetDate(null);
        return;
      }
      if (swipeAnimRef.current) return;
      if (swipeNavPendingRef.current) return;
      swipeNavPendingRef.current = true;
      const from = currentDate;
      const delta =
        viewMode === "week"
          ? dir === "prev"
            ? -5
            : 5
          : dir === "prev"
            ? -1
            : 1;
      const to = addDays(from, delta);
      const targetPct = dir === "next" ? -100 : 0;
      setSwipeAnim({
        dir,
        from,
        to,
        translatePct: dir === "next" ? 0 : -100,
      });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSwipeAnim((prev) => {
            if (
              !prev ||
              prev.to.getTime() !== to.getTime() ||
              prev.from.getTime() !== from.getTime()
            ) {
              return prev;
            }
            return { ...prev, translatePct: targetPct };
          });
          scheduleSwipeCompleteFallback();
        });
      });
    },
    [currentDate, scheduleSwipeCompleteFallback, viewMode],
  );

  // Pointer-based swipe → prev/next day on Day + 5-Day view (works for mouse,
  // touch, and pen). Skips when the gesture starts inside an appointment, the
  // toolbar, or any modal so other handlers aren't disturbed.
  const swipeRef = useRef({
    x: 0,
    y: 0,
    ts: 0,
    active: false,
    pointerId: null,
    captured: false,
    pointerType: null,
    captureEl: null,
  });
  const daySwipeSurfaceRef = useRef(null);
  const monthSwipeSurfaceRef = useRef(null);
  const swipeTouchStartRef = useRef(null);

  /**
   * Land each newly-mounted .cal-day__scroll pane at 08:00 (DAY_INITIAL_HOUR).
   * Uses a WeakSet so user scroll position is preserved across re-renders of
   * the same DOM node — only first attach (after a swipe-driven remount, or
   * the very first paint) snaps to 8 AM.
   */
  const dayScrollInitSetRef = useRef(null);
  if (dayScrollInitSetRef.current === null) {
    dayScrollInitSetRef.current = new WeakSet();
  }
  const setupDayScrollRef = useCallback((el) => {
    if (!el) return;
    const seen = dayScrollInitSetRef.current;
    if (seen.has(el)) return;
    seen.add(el);
    el.scrollTop = (DAY_INITIAL_HOUR - DAY_START_HOUR) * SLOT_HEIGHT;
  }, []);

  /**
   * Land the stacked-month scroll on TODAY's month block when the Month tab
   * is first opened. The blocks expose `data-month` (ISO of startOfMonth) so
   * we can do an exact offset query without recomputing positions.
   */
  const monthScrollInitSetRef = useRef(null);
  if (monthScrollInitSetRef.current === null) {
    monthScrollInitSetRef.current = new WeakSet();
  }
  const setupMonthScrollRef = useCallback((el) => {
    monthScrollElRef.current = el;
    if (!el) return;
    const seen = monthScrollInitSetRef.current;
    if (seen.has(el)) return;
    seen.add(el);
    const today = new Date();
    const targetIso = startOfMonth(today).toISOString();
    const scrollToToday = () => {
      const block = el.querySelector(`[data-month="${targetIso}"]`);
      if (!block) return;
      // Use bounding-rect delta so this works regardless of which ancestor is
      // the offsetParent. Pinning today's block to the top of the scroller
      // means the user starts on the current month and scrolls UP to reveal
      // earlier months / DOWN for upcoming months (Apple Calendar parity).
      const blockRect = block.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      el.scrollTop = el.scrollTop + (blockRect.top - elRect.top);
    };
    // Ref callbacks fire after commit but before paint; on some mobile
    // browsers the flex parent's height isn't finalized until the next frame,
    // so the first scrollTop write can clamp. Run once now and once on the
    // next animation frame for robustness.
    scrollToToday();
    requestAnimationFrame(scrollToToday);
  }, []);
  /** When pointer path already called beginSwipeNav, skip duplicate touchend (same gesture). */
  const swipeConsumedThisGestureRef = useRef(false);

  useEffect(() => {
    swipeAnimRef.current = swipeAnim;
  }, [swipeAnim]);

  const handleSwipePointerDown = useCallback(
    (e) => {
      if (swipeAnimRef.current) return;
      // Only accept primary mouse / touch / pen — ignore secondary buttons
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (
        e.target &&
        e.target.closest &&
        (e.target.closest(".cal-apt") ||
          e.target.closest(".cal-modal") ||
          e.target.closest(".cal-toolbar") ||
          e.target.closest(".cal-monthDaySheet"))
      ) {
        return;
      }
      swipeConsumedThisGestureRef.current = false;
      swipeRef.current = {
        x: e.clientX,
        y: e.clientY,
        ts: Date.now(),
        active: true,
        pointerId: e.pointerId ?? null,
        captured: false,
        pointerType: e.pointerType || "mouse",
        captureEl: e.currentTarget || null,
      };
    },
    [],
  );

  // PointerMove: once horizontal intent is clear, capture the pointer so the
  // pointerup is guaranteed to fire on this element even if the gesture
  // continues over scrolling children. Without this, mobile browsers can
  // hand off the gesture to the inner scroll container and pointerup never
  // arrives at our handler.
  const handleSwipePointerMove = useCallback(
    (e) => {
      const ref = swipeRef.current;
      if (!ref.active || swipeAnimRef.current) return;
      if (ref.pointerId != null && e.pointerId !== ref.pointerId) return;
      // Only attach pointer capture for fine pointers (mouse). On touch/pen,
      // capture routes all subsequent events to `.cal-day` instead of nested
      // `.cal-day__scroll`, which makes vertical scrolling feel "stuck" on iOS
      // Safari when a slight diagonal wobble clears the naive dx>dy test.
      // Touch day-swipe still works via bubbling pointer events + the passive
      // touchstart/touchend fallback on this same element.
      if (ref.pointerType !== "mouse") return;

      const dx = e.clientX - ref.x;
      const dy = e.clientY - ref.y;
      const captureThreshold = 12;
      const dxDominance =
        Math.abs(dy) < 0.5 ? Infinity : Math.abs(dx) / Math.abs(dy);
      // Require clearer horizontal intent before stealing the stream from mice
      // that jitter across scrollbar / grid borders.
      if (
        Math.abs(dx) > captureThreshold &&
        dxDominance > 1.75 &&
        !ref.captured
      ) {
        const el = ref.captureEl;
        if (el && typeof el.setPointerCapture === "function") {
          try {
            el.setPointerCapture(e.pointerId);
            ref.captured = true;
          } catch {
            // ignore — capture may fail on some browsers
          }
        }
      }
    },
    [],
  );

  const handleSwipePointerUp = useCallback(
    (e) => {
      const ref = swipeRef.current;
      if (!ref.active) return;
      if (swipeAnimRef.current) return;
      if (
        ref.pointerId != null &&
        e.pointerId != null &&
        e.pointerId !== ref.pointerId
      ) {
        return;
      }
      // Release capture if we had taken it
      if (ref.captured && ref.captureEl) {
        try {
          ref.captureEl.releasePointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
      }
      const dx = e.clientX - ref.x;
      const dy = e.clientY - ref.y;
      const dt = Date.now() - ref.ts;
      swipeRef.current.active = false;
      // Touch-friendly thresholds: 40px horizontal, allow up to 90px vertical
      // drift, generous 1.2s window so slow swipes still register on mobile.
      if (Math.abs(dx) < 40 || Math.abs(dy) > 90 || dt > 1200) return;
      // Require horizontal dominance (dx more than 1.4× dy) so vertical scroll
      // intents don't accidentally trigger a day change.
      if (Math.abs(dx) < Math.abs(dy) * 1.4) return;
      swipeConsumedThisGestureRef.current = true;
      beginSwipeNav(dx > 0 ? "prev" : "next");
    },
    [beginSwipeNav],
  );

  const handleSwipePointerCancel = useCallback((e) => {
    const ref = swipeRef.current;
    if (ref.captured && ref.captureEl) {
      try {
        ref.captureEl.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    }
    swipeRef.current = {
      x: 0,
      y: 0,
      ts: 0,
      active: false,
      pointerId: null,
      captured: false,
      pointerType: null,
      captureEl: null,
    };
  }, []);

  // Touch fallback: some mobile browsers drop pointer capture / coalesce events
  // with nested scrollers. Touches still deliver touchstart/touchend reliably.
  useEffect(() => {
    // Month view now scrolls vertically through stacked months (Apple-style),
    // so horizontal swipe nav doesn't apply there.
    if (viewMode === "month") return;
    const el = daySwipeSurfaceRef.current;
    if (!el) return;

    const swipeTargetFilter = (target) => {
      if (
        target &&
        target.closest &&
        (target.closest(".cal-apt") ||
          target.closest(".cal-modal") ||
          target.closest(".cal-toolbar") ||
          target.closest(".cal-monthDaySheet"))
      ) {
        return false;
      }
      return true;
    };

    const onTouchStart = (e) => {
      if (swipeAnimRef.current) return;
      if (e.touches.length !== 1) return;
      if (!swipeTargetFilter(e.target)) return;
      swipeConsumedThisGestureRef.current = false;
      const t = e.touches[0];
      swipeTouchStartRef.current = {
        x: t.clientX,
        y: t.clientY,
        ts: Date.now(),
      };
    };

    const onTouchEnd = (e) => {
      if (swipeAnimRef.current) return;
      const start = swipeTouchStartRef.current;
      swipeTouchStartRef.current = null;
      if (!start) return;
      if (swipeConsumedThisGestureRef.current) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const dt = Date.now() - start.ts;
      if (Math.abs(dx) < 40 || Math.abs(dy) > 90 || dt > 1200) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.4) return;
      swipeConsumedThisGestureRef.current = true;
      beginSwipeNav(dx > 0 ? "prev" : "next");
    };

    const onTouchCancel = () => {
      swipeTouchStartRef.current = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [viewMode, beginSwipeNav]);

  // Save handler from NewAppt overlay
  const handleSaveAppointment = useCallback(
    ({
      clientName,
      service,
      start,
      durationMinutes,
      color,
      price,
      notes,
      repeat, // { enabled, interval: 'day'|'week'|'month', count }
    }) => {
      const trimmedClient = (clientName || "").trim();
      if (!trimmedClient) return;
      const end = addMinutes(start, durationMinutes);
      const baseExtras = {
        clientName: trimmedClient,
        service: service || "",
        color,
        price: typeof price === "number" ? price : 0,
        notes: (notes || "").trim().slice(0, 500),
      };

      const buildOccurrences = () => {
        const occurrences = [{ start, end }];
        if (repeat && repeat.enabled && repeat.count > 1) {
          const stepFn =
            repeat.interval === "day"
              ? (d, n) => addDays(d, n)
              : repeat.interval === "month"
                ? (d, n) => addMonths(d, n)
                : (d, n) => addWeeks(d, n);
          for (let i = 1; i < repeat.count; i += 1) {
            const occStart = stepFn(start, i);
            const occEnd = stepFn(end, i);
            occurrences.push({ start: occStart, end: occEnd });
          }
        }
        return occurrences;
      };

      if (isAppointmentsApiAvailable()) {
        const finish = () => {
          setNewApptInit(null);
          setEditingApt(null);
        };

        const reportSaveError = (err) => {
          const detail = err instanceof Error ? err.message : "Save failed";
          setOverlapAlert({
            message: `Appointment was not saved (${detail}). Is demo-api reachable and did you run prisma migrate deploy on the database?`,
          });
        };

        const commitEvents = (updater) => {
          setEvents((prev) => {
            const next = typeof updater === "function" ? updater(prev) : updater;
            queueMicrotask(() => {
              appointmentsInitialFetchDoneRef.current = true;
              writeApiAppointmentsSessionCache(next);
            });
            return next;
          });
        };

        void (async () => {
          try {
            const occurrences = buildOccurrences();
            const seriesIdForMulti =
              occurrences.length > 1
                ? editingApt
                  ? editingApt.seriesId || `series-${Date.now().toString(36)}`
                  : `series-${Date.now().toString(36)}`
                : undefined;

            if (editingApt) {
              if (repeat && repeat.enabled && repeat.count > 1) {
                await deleteAppointmentRemote(editingApt.id);
                finish();
                const created = [];
                for (const o of occurrences) {
                  const { appointment } = await createAppointmentRemote({
                    clientName: baseExtras.clientName,
                    service: baseExtras.service,
                    start: o.start.toISOString(),
                    end: o.end.toISOString(),
                    color: baseExtras.color,
                    price: baseExtras.price,
                    notes: baseExtras.notes,
                    ...(seriesIdForMulti ? { seriesId: seriesIdForMulti } : {}),
                  });
                  created.push(appointmentDtoToEvent(appointment));
                }
                commitEvents((prev) => [
                  ...prev.filter((ev) => ev.id !== editingApt.id),
                  ...created,
                ]);
                refreshAppointmentsRef.current();
              } else {
                const patch = {
                  clientName: baseExtras.clientName,
                  service: baseExtras.service,
                  start: start.toISOString(),
                  end: end.toISOString(),
                  color: baseExtras.color,
                  price: baseExtras.price,
                  notes: baseExtras.notes,
                };
                if (editingApt.seriesId) patch.seriesId = editingApt.seriesId;
                const prevSnap = {
                  ...editingApt,
                  start: new Date(editingApt.start),
                  end: new Date(editingApt.end),
                };
                setEvents((prev) =>
                  prev.map((ev) =>
                    ev.id === editingApt.id ? { ...ev, ...baseExtras, start, end } : ev,
                  ),
                );
                finish();
                try {
                  const { appointment } = await updateAppointmentRemote(editingApt.id, patch);
                  setEvents((prev) =>
                    prev.map((ev) =>
                      ev.id === editingApt.id ? appointmentDtoToEvent(appointment) : ev,
                    ),
                  );
                  refreshAppointmentsRef.current();
                } catch (e) {
                  console.warn("[Calendar] appointments API save failed", e);
                  reportSaveError(e);
                  setEvents((prev) =>
                    prev.map((ev) => (ev.id === prevSnap.id ? prevSnap : ev)),
                  );
                }
              }
            } else {
              const optimistic = occurrences.map((o) => ({
                id: makeEventId(),
                ...baseExtras,
                start: o.start,
                end: o.end,
                ...(seriesIdForMulti ? { seriesId: seriesIdForMulti } : {}),
              }));
              const optimisticIds = optimistic.map((e) => e.id);
              setEvents((prev) => [...prev, ...optimistic]);
              finish();
              try {
                const created = [];
                for (const o of occurrences) {
                  const { appointment } = await createAppointmentRemote({
                    clientName: baseExtras.clientName,
                    service: baseExtras.service,
                    start: o.start.toISOString(),
                    end: o.end.toISOString(),
                    color: baseExtras.color,
                    price: baseExtras.price,
                    notes: baseExtras.notes,
                    ...(seriesIdForMulti ? { seriesId: seriesIdForMulti } : {}),
                  });
                  created.push(appointmentDtoToEvent(appointment));
                }
                commitEvents((prev) => [
                  ...prev.filter((e) => !optimisticIds.includes(e.id)),
                  ...created,
                ]);
                refreshAppointmentsRef.current();
              } catch (err) {
                console.warn("[Calendar] appointments API save failed", err);
                reportSaveError(err);
                setEvents((prev) => prev.filter((e) => !optimisticIds.includes(e.id)));
              }
            }
          } catch (err) {
            console.warn("[Calendar] appointments API save failed", err);
            reportSaveError(err);
            finish();
          }
        })();
        return;
      }

      if (editingApt) {
        if (repeat && repeat.enabled && repeat.count > 1) {
          const occurrences = [{ start, end }];
          const stepFn =
            repeat.interval === "day"
              ? (d, n) => addDays(d, n)
              : repeat.interval === "month"
                ? (d, n) => addMonths(d, n)
                : (d, n) => addWeeks(d, n);
          for (let i = 1; i < repeat.count; i += 1) {
            const occStart = stepFn(start, i);
            const occEnd = stepFn(end, i);
            occurrences.push({ start: occStart, end: occEnd });
          }
          const seriesId =
            occurrences.length > 1
              ? editingApt.seriesId || `series-${Date.now().toString(36)}`
              : undefined;
          const newEvents = occurrences.map((o, idx) => ({
            id: idx === 0 ? editingApt.id : makeEventId(),
            ...baseExtras,
            start: o.start,
            end: o.end,
            ...(seriesId ? { seriesId } : {}),
          }));
          setEvents((prev) => [
            ...prev.filter((ev) => ev.id !== editingApt.id),
            ...newEvents,
          ]);
        } else {
          setEvents((prev) =>
            prev.map((ev) =>
              ev.id === editingApt.id ? { ...ev, ...baseExtras, start, end } : ev,
            ),
          );
        }
      } else {
        const occurrences = [{ start, end }];
        if (repeat && repeat.enabled && repeat.count > 1) {
          const stepFn =
            repeat.interval === "day"
              ? (d, n) => addDays(d, n)
              : repeat.interval === "month"
                ? (d, n) => addMonths(d, n)
                : (d, n) => addWeeks(d, n);
          for (let i = 1; i < repeat.count; i += 1) {
            const occStart = stepFn(start, i);
            const occEnd = stepFn(end, i);
            occurrences.push({ start: occStart, end: occEnd });
          }
        }
        const seriesId = occurrences.length > 1 ? `series-${Date.now().toString(36)}` : undefined;
        const newEvents = occurrences.map((o) => ({
          id: makeEventId(),
          ...baseExtras,
          start: o.start,
          end: o.end,
          ...(seriesId ? { seriesId } : {}),
        }));
        setEvents((prev) => [...prev, ...newEvents]);
      }
      setNewApptInit(null);
      setEditingApt(null);
      setNewApptSeedClient(null);
    },
    [editingApt],
  );

  // Cancel handler — confirm then remove
  const performCancelAppointment = useCallback((apt) => {
    const closeModals = () => {
      setConfirmCancelApt(null);
      setAptOptionsApt(null);
    };
    if (isAppointmentsApiAvailable()) {
      const snapshot = { ...apt, start: new Date(apt.start), end: new Date(apt.end) };
      setEvents((prev) => prev.filter((ev) => ev.id !== apt.id));
      closeModals();
      void deleteAppointmentRemote(apt.id)
        .then(() => {
          refreshAppointmentsRef.current();
        })
        .catch((err) => {
        console.warn("[Calendar] appointments API delete failed", err);
        setOverlapAlert({
          message: `Could not delete appointment (${err instanceof Error ? err.message : "error"}).`,
        });
        setEvents((prev) =>
          [...prev, snapshot].sort((a, b) => a.start.getTime() - b.start.getTime()),
        );
      });
      return;
    }
    setEvents((prev) => prev.filter((ev) => ev.id !== apt.id));
    closeModals();
  }, []);

  const openModifyForApt = useCallback((apt) => {
    setEditingApt(apt);
    setNewApptInit(apt.start);
    setAptOptionsApt(null);
  }, []);

  return (
    <div className="cal-root">
      <CalendarDecorations onGoToToday={handleGoToToday} />
      <div className="cal-header">
        {viewMode !== "month" ? (
          <h1 className="cal-header__monthTitle">{format(currentDate, "MMMM yyyy")}</h1>
        ) : null}
        <div className="cal-header__row">
          <button
            type="button"
            className="cal-nav cal-headerBack"
            onClick={handleExitCalendar}
            aria-label={calendarBackTarget === "/climax" ? "Back to checkout" : "Back"}
          >
            <ArrowIcon dir="left" />
          </button>
          <div className="cal-header__tabsCell">
            <div className="cal-tabs" role="tablist" aria-label="Calendar view">
              <button
                className={`cal-tab ${viewMode === "day" ? "is-active" : ""}`}
                onClick={() => {
                  resetSwipeNav();
                  setViewMode("day");
                }}
              >
                Day
              </button>
              <button
                className={`cal-tab ${viewMode === "week" ? "is-active" : ""}`}
                onClick={() => {
                  resetSwipeNav();
                  setViewMode("week");
                }}
              >
                5 Day
              </button>
              <button
                className={`cal-tab ${viewMode === "month" ? "is-active" : ""}`}
                onClick={() => {
                  resetSwipeNav();
                  setViewMode("month");
                  setMonthSheetDate(null);
                }}
              >
                Month
              </button>
              <span className="cal-tabDivider is-1" aria-hidden="true" />
              <span className="cal-tabDivider is-2" aria-hidden="true" />
              <span className="cal-tabIndicator" data-mode={viewMode} />
            </div>
          </div>
          <button
            type="button"
            className="cal-header__trailing cal-header__todayHit"
            onClick={handleGoToToday}
            aria-label="Go to today"
          />
        </div>
      </div>

      {viewMode !== "month" ? (
        <div className="cal-weekrow">
          {(viewMode === "week" ? fiveDayDates : weekDates).map((d) => {
            const selected = isSameDay(d, currentDate);
            const today = isToday(d);
            return (
              <button
                key={d.toISOString()}
                className={`cal-daychip ${selected ? "is-selected" : ""} ${today ? "is-today" : ""}`}
                onClick={() => {
                  resetSwipeNav();
                  setCurrentDate(d);
                }}
              >
                <div className="cal-daychip__dow">{format(d, "EEEEE")}</div>
                <div className="cal-daychip__num">{format(d, "d")}</div>
              </button>
            );
          })}
        </div>
      ) : null}

      {viewMode !== "month" ? (
        <div
          className={`cal-toolbar${
            dragApt ? " is-dragging" : ""
          }${parkHover ? " is-parkTarget" : ""}`}
        >
          <div className="cal-toolbar__center">
            {parked.length === 0 ? null : parked.length === 1 ? (
              viewMode === "day" ? (
                <div
                  className={`cal-pill is-parked cal-pill--draggable${parked[0].fromMove ? " is-fromMove" : ""}`}
                  style={{ touchAction: "none" }}
                  onPointerDown={(e) => handleParkedPointerDown(e, parked[0])}
                  onPointerMove={(e) => handleParkedPointerMove(e, parked[0])}
                  onPointerUp={(e) => handleParkedPointerUp(e, parked[0])}
                  onPointerCancel={(e) => handleParkedPointerCancel(e, parked[0])}
                  onContextMenu={(e) => e.preventDefault()}
                  title="Long-press to drag to calendar"
                >
                  <span className="cal-pill__stripe" aria-hidden="true" />
                  <span className="cal-pill__text">{parked[0].title}</span>
                </div>
              ) : (
                <button
                  type="button"
                  className={`cal-pill is-parked cal-pill--button${parked[0].fromMove ? " is-fromMove" : ""}`}
                  onClick={() => setParkedModalOpen(true)}
                >
                  <span className="cal-pill__stripe" aria-hidden="true" />
                  <span className="cal-pill__text">{parked[0].title}</span>
                </button>
              )
            ) : (
              <button
                type="button"
                className="cal-pill is-parked cal-pill--button cal-pill--parkedCollapsed"
                onClick={() => setParkedModalOpen(true)}
              >
                <span className="cal-pill__stripe" aria-hidden="true" />
                <span className="cal-pill__text">Parked ({parked.length})</span>
              </button>
            )}
            {parked.length > 0 && waitlist.length > 0 ? (
              <span className="cal-toolbar__gap" aria-hidden />
            ) : null}

            {waitlist.length === 0 ? null : waitlist.length === 1 ? (
              viewMode === "day" ? (
                <div
                  className="cal-pill is-waitlist cal-pill--draggable"
                  style={{ touchAction: "none" }}
                  onPointerDown={(e) => handleWaitlistPointerDown(e, waitlist[0])}
                  onPointerMove={(e) => handleWaitlistPointerMove(e, waitlist[0])}
                  onPointerUp={(e) => handleWaitlistPointerUp(e, waitlist[0])}
                  onPointerCancel={(e) => handleWaitlistPointerCancel(e, waitlist[0])}
                  onContextMenu={(e) => e.preventDefault()}
                  title="Long-press to drag to calendar"
                >
                  <span className="cal-pill__dot" aria-hidden="true" />
                  <span className="cal-pill__text">{waitlist[0].title}</span>
                </div>
              ) : (
                <button
                  type="button"
                  className="cal-pill is-waitlist cal-pill--button"
                  onClick={() => setWaitlistModalOpen(true)}
                >
                  <span className="cal-pill__dot" aria-hidden="true" />
                  <span className="cal-pill__text">{waitlist[0].title}</span>
                </button>
              )
            ) : (
              <button
                type="button"
                className="cal-pill is-waitlist cal-pill--button"
                onClick={() => setWaitlistModalOpen(true)}
              >
                <span className="cal-pill__dot" aria-hidden="true" />
                <span className="cal-pill__text">Waiting ({waitlist.length})</span>
              </button>
            )}
          </div>
        </div>
      ) : null}

      {viewMode === "month" ? (
        <div ref={monthSwipeSurfaceRef} className="cal-monthSwipe">
          {/* Day-of-week labels stay pinned at the top while the months
              scroll underneath (Apple Calendar parity). */}
          <div className="cal-month__head" aria-hidden>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((l) => (
              <div key={l} className="cal-month__hcell">
                {l}
              </div>
            ))}
          </div>
          <div className="cal-monthScroll" ref={setupMonthScrollRef}>
            {monthWindow.map((monthDate) => {
              const weeks = monthWeeksFor(monthDate);
              const monthIso = monthDate.toISOString();
              return (
                <div
                  key={monthIso}
                  data-month={monthIso}
                  className="cal-monthBlock"
                >
                  <div className="cal-monthBlock__title">
                    {format(monthDate, "MMMM yyyy")}
                  </div>
                  <div className="cal-monthBlock__weeks">
                    {weeks.map((week, wi) => (
                      <div key={wi} className="cal-month__week">
                        {week.map((d) => {
                          const inMonth = isSameMonth(d, monthDate);
                          const dayDots = calendarEvents
                            .filter((a) => isSameDay(a.start, d))
                            .sort((a, b) => a.start.getTime() - b.start.getTime())
                            .slice(0, 3);
                          const sheetSelected =
                            monthSheetDate != null && isSameDay(d, monthSheetDate);
                          return (
                            <button
                              type="button"
                              key={d.toISOString()}
                              className={`cal-month__cell${sheetSelected ? " is-selected" : ""}${
                                !inMonth ? " is-muted" : ""
                              }${isToday(d) ? " is-today" : ""}`}
                              onClick={() => goToDayForScheduling(d)}
                            >
                              <div className="cal-month__num">{format(d, "d")}</div>
                              <div className="cal-month__dots">
                                {dayDots.map((apt) => (
                                  <span
                                    key={apt.id}
                                    className={`dot ${colorToDotClass(apt.color)}`}
                                    aria-hidden
                                  />
                                ))}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {monthSheetDate ? (
            <div className="cal-monthDaySheet">
              <div className="cal-monthDaySheet__head">
                <span className="cal-monthDaySheet__title">
                  {format(monthSheetDate, "EEE, MMM d")}
                </span>
                <button
                  type="button"
                  className="cal-monthDaySheet__close"
                  onClick={() => setMonthSheetDate(null)}
                  aria-label="Close"
                >
                  <X size={18} weight="bold" />
                </button>
              </div>
              {monthSheetAppointments.length === 0 ? (
                <p className="cal-monthDaySheet__empty">No appointments</p>
              ) : (
                <ul className="cal-monthDaySheet__list">
                  {monthSheetAppointments.map((apt) => (
                    <li key={apt.id}>
                      <button
                        type="button"
                        className="cal-monthDayRow"
                        onPointerUp={(e) => {
                          if (e.pointerType === "mouse" && e.button !== 0) return;
                          scheduleAppointmentOptionsDoubleTap(apt);
                        }}
                      >
                        <span
                          className={`cal-monthDayRow__stripe ${colorToClass(apt.color)}`}
                          aria-hidden
                        />
                        <span className="cal-monthDayRow__body">
                          <span className="cal-monthDayRow__time">
                            {format(apt.start, "h:mm a")} – {format(apt.end, "h:mm a")}
                          </span>
                          <span className="cal-monthDayRow__client">
                            {apt.clientName || "Client"}
                          </span>
                          {apt.service ? (
                            <span className="cal-monthDayRow__svc">{apt.service}</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      ) : (() => {
          const getColumnsFor = (baseDate) =>
            viewMode === "week"
              ? Array.from({ length: 5 }, (_, i) => addDays(baseDate, i))
              : [baseDate];

          const renderColumnContent = (baseDate, day, includeColumnHead) => {
            const dayEvents = calendarEvents.filter((a) => isSameDay(a.start, day));
            const dayPositioned = layoutDayAppointments(dayEvents);
            const showLiveLine = isToday(day) && liveTimeLineMin !== null;
            return (
              <div
                key={day.toISOString()}
                className={`cal-day__col${includeColumnHead ? " cal-day__col--week" : ""}`}
              >
                <div
                  className="cal-day__grid"
                  onClick={(e) => handleGridClick(e, day)}
                >
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="cal-grid__row"
                      style={{ height: SLOT_HEIGHT }}
                    />
                  ))}
                  {dayPositioned.map(({ apt, colIndex, totalCols }) => {
                    const topMin = clamp(minutesSinceStart(apt.start), 0, MINUTES_PER_DAY);
                    const endMin = clamp(minutesSinceStart(apt.end), 0, MINUTES_PER_DAY);
                    const top = (topMin / 60) * SLOT_HEIGHT;
                    const aptH = Math.max(28, ((endMin - topMin) / 60) * SLOT_HEIGHT);
                    const colW = (1 / totalCols) * 100;
                    const left = colIndex * colW;
                    const isOverlap = totalCols > 1;
                    const isDragging = dragApt === apt.id;
                    const timerKey = apt.id != null ? String(apt.id) : '';
                    const timerState = timerKey ? runningTimers[timerKey] : undefined;
                    const hasActiveTimer =
                      timerState &&
                      (timerState.kind === "timerRunning" ||
                        timerState.kind === "stopwatchRunning" ||
                        timerState.kind === "completed");
                    const isNewClient = !knownClientNames.has(
                      (apt.clientName || "").trim().toLowerCase()
                    );
                    const dragTransform =
                      isDragging && dragOffset
                        ? `translate3d(${dragOffset.dx}px, ${dragOffset.dy}px, 0)`
                        : undefined;
                    const visualHeight =
                      isDragging && resizeDelta !== 0
                        ? Math.max(28, aptH + resizeDelta)
                        : aptH;
                    // Live preview times during drag — keeps the card's time
                    // text in sync with where the user is dropping it.
                    let displayStart = apt.start;
                    let displayEnd = apt.end;
                    if (isDragging && dragPreviewMin != null) {
                      const ps = new Date(apt.start);
                      ps.setHours(DAY_START_HOUR, 0, 0, 0);
                      ps.setMinutes(dragPreviewMin);
                      displayStart = ps;
                      displayEnd = addMinutes(
                        ps,
                        differenceInMinutes(apt.end, apt.start),
                      );
                    } else if (isDragging && resizeDelta !== 0) {
                      const minDelta = (resizeDelta / SLOT_HEIGHT) * 60;
                      const baseDur = differenceInMinutes(apt.end, apt.start);
                      const newDur = Math.max(5, snapMinutes(baseDur + minDelta));
                      displayEnd = addMinutes(apt.start, newDur);
                    }
                    return (
                      <div
                        key={apt.id}
                        className={`cal-apt ${colorToClass(apt.color)}${isDragging ? " is-dragging" : ""}${isOverlap ? " is-overlap" : ""}`}
                        style={{
                          top,
                          height: visualHeight,
                          left: `calc(${left}% + ${colIndex === 0 ? 0 : 2}px)`,
                          width: `calc(${colW}% - ${totalCols === 1 ? 0 : colIndex === 0 || colIndex === totalCols - 1 ? 2 : 4}px)`,
                          zIndex: isDragging ? 50 : 5 + colIndex,
                          touchAction: "none",
                          transform: dragTransform,
                        }}
                        role="button"
                        tabIndex={0}
                        onPointerDown={(e) => handleAptPointerDown(e, apt)}
                        onPointerMove={(e) => handleAptPointerMove(e, apt)}
                        onPointerUp={(e) => handleAptPointerUp(e, apt)}
                        onPointerCancel={(e) => handleAptPointerCancel(e, apt)}
                      >
                        <div className="cal-apt__client">{apt.clientName}</div>
                        <div className="cal-apt__service">{apt.service}</div>
                        <div className="cal-apt__time">
                          {format(displayStart, "h:mm a")} – {format(displayEnd, "h:mm a")}
                        </div>
                        {hasActiveTimer ? (
                          <span
                            className={`cal-apt__alarm${
                              timerState.kind === "completed" ? " is-completed" : ""
                            }`}
                            aria-label={
                              timerState.kind === "completed"
                                ? "Timer completed"
                                : "Timer running"
                            }
                          >
                            <Bell size={12} weight="fill" aria-hidden />
                          </span>
                        ) : null}
                        {isNewClient ? (
                          <span
                            className="cal-apt__newDot"
                            aria-label="New client"
                            title="New client"
                          />
                        ) : null}
                        {apt.fromWaitlist ? (
                          <span className="cal-apt__waitTag" aria-hidden>
                            Waiting
                          </span>
                        ) : null}
                        <div
                          className="cal-apt__resize"
                          aria-label="Resize appointment"
                          onPointerDown={(e) => handleResizePointerDown(e, apt)}
                          onPointerMove={(e) => handleAptPointerMove(e, apt)}
                          onPointerUp={(e) => handleAptPointerUp(e, apt)}
                          onPointerCancel={(e) => handleAptPointerCancel(e, apt)}
                        >
                          <span className="cal-apt__resizeBar" />
                        </div>
                      </div>
                    );
                  })}
                  {showLiveLine ? (
                    <div
                      className="cal-now"
                      style={{ top: (liveTimeLineMin / 60) * SLOT_HEIGHT }}
                      aria-label="Current time"
                    >
                      <span className="cal-now__dot" />
                      <span className="cal-now__line" />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          };

          const renderDayWeekBody = (baseDate) => {
            const columns = getColumnsFor(baseDate);
            return (
              <div className="cal-day__scroll" ref={setupDayScrollRef}>
                <div className="cal-day__axis" style={{ width: TIME_AXIS_WIDTH }}>
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="cal-axis__row"
                      style={{ height: SLOT_HEIGHT }}
                    >
                      <span className="cal-axis__label">
                        {format(new Date(0, 0, 0, h), "h a")}
                      </span>
                    </div>
                  ))}
                </div>
                {viewMode === "week" ? (
                  <div className="cal-day__weekGrid">
                    {columns.map((d) => renderColumnContent(baseDate, d, true))}
                  </div>
                ) : (
                  renderColumnContent(baseDate, baseDate, false)
                )}
              </div>
            );
          };

          return (
            <div
              ref={daySwipeSurfaceRef}
              className={`cal-day${viewMode === "week" ? " cal-day--week" : ""}${
                swipeAnim ? " is-swiping" : ""
              }`}
              onPointerDown={handleSwipePointerDown}
              onPointerMove={handleSwipePointerMove}
              onPointerUp={handleSwipePointerUp}
              onPointerCancel={handleSwipePointerCancel}
            >
              {swipeAnim ? (
                <div className="cal-swipeViewport">
                  <div
                    className="cal-swipeTrack"
                    style={{
                      transform: `translate3d(${swipeAnim.translatePct}%, 0, 0)`,
                    }}
                    onTransitionEnd={handleSwipeTransitionEnd}
                  >
                    {swipeAnim.dir === "next" ? (
                      <>
                        <div className="cal-swipePane">{renderDayWeekBody(swipeAnim.from)}</div>
                        <div className="cal-swipePane">{renderDayWeekBody(swipeAnim.to)}</div>
                      </>
                    ) : (
                      <>
                        <div className="cal-swipePane">{renderDayWeekBody(swipeAnim.to)}</div>
                        <div className="cal-swipePane">{renderDayWeekBody(swipeAnim.from)}</div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                renderDayWeekBody(currentDate)
              )}
            </div>
          );
        })()}

      {/* Appointment options (single tap on appointment) */}
      {aptOptionsApt ? (
        <div
          className="cal-modal"
          role="dialog"
          aria-modal="true"
          onClickCapture={(e) => {
            if (Date.now() < suppressModalClickUntilRef.current) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onPointerUpCapture={(e) => {
            if (Date.now() < suppressModalClickUntilRef.current) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <button
            type="button"
            className="cal-modal__backdrop"
            onClick={() => setAptOptionsApt(null)}
            aria-label="Close"
          />
          <div className="cal-modal__card">
            <div className="cal-modal__title">Appointment Options</div>
            <div className="cal-modal__subtitle">
              {aptOptionsApt.clientName} • {format(aptOptionsApt.start, "h:mm a")} – {format(aptOptionsApt.end, "h:mm a")}
            </div>
            <button
              type="button"
              className="cal-modal__btn"
              onClick={() => {
                if (Date.now() < suppressModalClickUntilRef.current) return;
                setAptOptionsApt(null);
                // `from` lets Screen2's top-left Back button return to Calendar
                navigate("/screen2", { state: { apt: aptOptionsApt, from: "/calendar" } });
              }}
            >
              See Client Card
            </button>
            <button
              type="button"
              className="cal-modal__btn"
              onClick={() => openModifyForApt(aptOptionsApt)}
            >
              Modify appointment
            </button>
            <button
              type="button"
              className="cal-modal__btn"
              onClick={() => {
                if (Date.now() < suppressModalClickUntilRef.current) return;
                setRescheduleApt(aptOptionsApt);
                setAptOptionsApt(null);
              }}
            >
              Reschedule appointment
            </button>
            <button
              type="button"
              className="cal-modal__btn"
              onClick={() => {
                if (Date.now() < suppressModalClickUntilRef.current) return;
                setConfirmCancelApt(aptOptionsApt);
              }}
            >
              Cancel appointment
            </button>
            <button type="button" className="cal-modal__close" onClick={() => setAptOptionsApt(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {/* Empty slot tap → 3-option modal */}
      {emptySlotInfo
        ? (() => {
            const slotDate = emptySlotInfo.date;
            const slotTime = new Date(slotDate);
            slotTime.setHours(emptySlotInfo.hour, emptySlotInfo.minute, 0, 0);
            return (
              <div className="cal-modal" role="dialog" aria-modal="true">
                <button
                  className="cal-modal__backdrop"
                  onClick={() => setEmptySlotInfo(null)}
                  aria-label="Close"
                />
                <div className="cal-modal__card cal-emptyModal">
                  <div className="cal-emptyModal__head">
                    <div className="cal-emptyModal__heading">
                      <div className="cal-emptyModal__date">{format(slotDate, "EEE, MMM d, yyyy")}</div>
                      <div className="cal-emptyModal__time">{format(slotTime, "h:mm a")}</div>
                    </div>
                    <button
                      type="button"
                      className="cal-modal__iconBtn"
                      aria-label="Close"
                      onClick={() => setEmptySlotInfo(null)}
                    >
                      <X size={16} weight="bold" aria-hidden />
                    </button>
                  </div>
                  <div className="cal-emptyModal__divider" aria-hidden />
                  <button
                    type="button"
                    className="cal-emptyOption"
                    onClick={() =>
                      openNewAppointmentAt(slotDate, emptySlotInfo.hour, emptySlotInfo.minute)
                    }
                  >
                    <span className="cal-emptyOption__icon is-newAppt" aria-hidden>
                      <ClipboardText size={22} weight="duotone" />
                    </span>
                    <span className="cal-emptyOption__text">
                      <span className="cal-emptyOption__title">New appointment</span>
                      <span className="cal-emptyOption__sub">Create a new appointment</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="cal-emptyOption"
                    onClick={() => setEmptySlotInfo(null)}
                    title="Coming soon"
                  >
                    <span className="cal-emptyOption__icon is-personal" aria-hidden>
                      <UserList size={22} weight="duotone" />
                    </span>
                    <span className="cal-emptyOption__text">
                      <span className="cal-emptyOption__title">Personal task</span>
                      <span className="cal-emptyOption__sub">Create a personal task</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="cal-emptyOption"
                    onClick={() => setEmptySlotInfo(null)}
                    title="Coming soon"
                  >
                    <span className="cal-emptyOption__icon is-hours" aria-hidden>
                      <PencilSimpleLine size={22} weight="duotone" />
                    </span>
                    <span className="cal-emptyOption__text">
                      <span className="cal-emptyOption__title">Edit working hours</span>
                      <span className="cal-emptyOption__sub">Edit your calendar working hours</span>
                    </span>
                  </button>
                </div>
              </div>
            );
          })()
        : null}

      {/* Overlap alert */}
      {overlapAlert ? (
        <div className="cal-modal" role="dialog" aria-modal="true">
          <button
            className="cal-modal__backdrop"
            onClick={() => setOverlapAlert(null)}
            aria-label="Close"
          />
          <div className="cal-modal__card cal-modal__card--confirm">
            <div className="cal-modal__title">Can't overbook</div>
            <div className="cal-modal__subtitle">{overlapAlert.message}</div>
            <div className="cal-modal__row">
              <button
                className="cal-modal__btn cal-modal__btn--primary"
                onClick={() => setOverlapAlert(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Cancel confirm */}
      {confirmCancelApt ? (
        <div className="cal-modal" role="dialog" aria-modal="true">
          <button className="cal-modal__backdrop" onClick={() => setConfirmCancelApt(null)} aria-label="Close" />
          <div className="cal-modal__card cal-modal__card--confirm">
            <div className="cal-modal__title">Cancel appointment?</div>
            <div className="cal-modal__subtitle">
              {confirmCancelApt.clientName} • {format(confirmCancelApt.start, "h:mm a")}
            </div>
            <div className="cal-modal__row">
              <button className="cal-modal__btn cal-modal__btn--ghost" onClick={() => setConfirmCancelApt(null)}>
                No
              </button>
              <button
                className="cal-modal__btn cal-modal__btn--danger"
                onClick={() => performCancelAppointment(confirmCancelApt)}
              >
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Waiting list modal — long-press a card and drag to calendar */}
      {waitlistModalOpen ? (
        <div
          className={`cal-modal cal-modal--picker${waitlistDrag ? " is-dragHidden" : ""}`}
          role="dialog"
          aria-modal="true"
        >
          <button
            className="cal-modal__backdrop"
            onClick={() => setWaitlistModalOpen(false)}
            aria-label="Close"
          />
          <div className="cal-modal__card cal-waitlist">
            <div className="cal-modal__formHead">
              <div>
                <div className="cal-modal__title">Waiting List</div>
                <div className="cal-waitlist__hint">Long-press and drag to calendar</div>
              </div>
              <button
                type="button"
                className="cal-modal__iconBtn"
                aria-label="Close"
                onClick={() => setWaitlistModalOpen(false)}
              >
                <X size={16} weight="bold" aria-hidden />
              </button>
            </div>
            <div className="cal-waitlist__list">
              {waitlist.length === 0 ? (
                <div className="cal-pickerEmpty">No clients waiting</div>
              ) : (
                waitlist.map((item) => (
                  <div
                    key={item.id}
                    className="cal-waitlist__card"
                    style={viewMode === "day" ? { touchAction: "none" } : undefined}
                    onPointerDown={viewMode === "day" ? (e) => handleWaitlistPointerDown(e, item) : undefined}
                    onPointerMove={viewMode === "day" ? (e) => handleWaitlistPointerMove(e, item) : undefined}
                    onPointerUp={viewMode === "day" ? (e) => handleWaitlistPointerUp(e, item) : undefined}
                    onPointerCancel={viewMode === "day" ? (e) => handleWaitlistPointerCancel(e, item) : undefined}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <span className="cal-waitlist__stripe" aria-hidden />
                    <div className="cal-waitlist__body">
                      <div className="cal-waitlist__name">{item.title}</div>
                      <div className="cal-waitlist__svc">
                        Waiting for: {item.service || "—"}
                      </div>
                    </div>
                    <div className="cal-waitlist__when">
                      {format(new Date(item.waitlistAddedAt), "M/d  HH:mm")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Floating drag-time tooltip */}
      {dragTooltip ? (
        <div
          className={`cal-dragTip${dragTooltip.kind === "park" ? " is-park" : ""}`}
          style={{ left: dragTooltip.x, top: dragTooltip.y }}
          aria-hidden
        >
          <span className="cal-dragTip__dot" />
          <span className="cal-dragTip__label">{dragTooltip.label}</span>
        </div>
      ) : null}

      {/* Move / Park confirm modal */}
      {moveConfirm ? (
        <div className="cal-modal" role="dialog" aria-modal="true">
          <button
            className="cal-modal__backdrop"
            onClick={handleMoveConfirmNo}
            aria-label="Cancel"
          />
          <div className="cal-modal__card cal-confirm">
            {moveConfirm.kind === "park" ? (
              <>
                <div className="cal-modal__title">Park appointment</div>
                <div className="cal-confirm__body">
                  Are you sure you want to park this appointment?
                </div>
              </>
            ) : (
              <>
                <div className="cal-modal__title cal-confirm__time">
                  {format(moveConfirm.currentStart, "h:mm a")}
                </div>
                <div className="cal-confirm__body">
                  Are you sure you want to {moveConfirm.kind === "resize" ? "resize" : "move"} this appointment?
                </div>
              </>
            )}
            <div className="cal-modal__row">
              <button
                type="button"
                className="cal-modal__btn cal-modal__btn--ghost"
                onClick={handleMoveConfirmNo}
              >
                {moveConfirm.kind === "park" ? "Cancel" : "No"}
              </button>
              <button
                type="button"
                className="cal-modal__btn cal-modal__btn--primary"
                onClick={handleMoveConfirmYes}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Floating ghost during waitlist drag — portaled to <body> so the
          parent <transform: scale()> shell doesn't trap `position: fixed`. */}
      {waitlistDrag
        ? createPortal(
            <div
              className="cal-apt cal-apt--ghost is-green"
              style={{ left: waitlistDrag.x, top: waitlistDrag.y }}
              aria-hidden
            >
              <div className="cal-apt__client">{waitlistDrag.item.title}</div>
              <div className="cal-apt__service">
                {waitlistDrag.item.service || "Waiting"}
              </div>
              <div className="cal-apt__time">60 min</div>
            </div>,
            document.body,
          )
        : null}

      {/* Parked overflow modal — long-press a card and drag to calendar */}
      {parkedModalOpen ? (
        <div
          className={`cal-modal cal-modal--picker${parkedDrag ? " is-dragHidden" : ""}`}
          role="dialog"
          aria-modal="true"
        >
          <button
            className="cal-modal__backdrop"
            onClick={() => setParkedModalOpen(false)}
            aria-label="Close"
          />
          <div className="cal-modal__card cal-waitlist cal-parkedList">
            <div className="cal-modal__formHead">
              <div>
                <div className="cal-modal__title">Parked</div>
                <div className="cal-waitlist__hint">Long-press and drag to calendar</div>
              </div>
              <button
                type="button"
                className="cal-modal__iconBtn"
                aria-label="Close"
                onClick={() => setParkedModalOpen(false)}
              >
                <X size={16} weight="bold" aria-hidden />
              </button>
            </div>
            <div className="cal-waitlist__list">
              {parked.length === 0 ? (
                <div className="cal-pickerEmpty">No parked appointments</div>
              ) : (
                parked.map((item) => (
                  <div
                    key={item.id}
                    className={`cal-waitlist__card cal-parkedCard${item.fromMove ? " is-fromMove" : ""}`}
                    style={viewMode === "day" ? { touchAction: "none" } : undefined}
                    onPointerDown={viewMode === "day" ? (e) => handleParkedPointerDown(e, item) : undefined}
                    onPointerMove={viewMode === "day" ? (e) => handleParkedPointerMove(e, item) : undefined}
                    onPointerUp={viewMode === "day" ? (e) => handleParkedPointerUp(e, item) : undefined}
                    onPointerCancel={viewMode === "day" ? (e) => handleParkedPointerCancel(e, item) : undefined}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <span className="cal-waitlist__stripe" aria-hidden />
                    <div className="cal-waitlist__body">
                      <div className="cal-waitlist__name">{item.title}</div>
                      <div className="cal-waitlist__svc">
                        {item.service ? `Parked · ${item.service}` : "Parked"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Notify-client confirm — opens after a successful move / resize / park */}
      {notifyConfirm ? (
        <div className="cal-modal" role="dialog" aria-modal="true">
          <button
            className="cal-modal__backdrop"
            onClick={handleNotifyConfirmNo}
            aria-label="Skip"
          />
          <div className="cal-modal__card cal-confirm">
            <div className="cal-modal__title">Notify client?</div>
            <div className="cal-confirm__body">
              Send {notifyConfirm.clientName} an update that the appointment was {notifyConfirm.action}?
            </div>
            <div className="cal-modal__row">
              <button
                type="button"
                className="cal-modal__btn cal-modal__btn--ghost"
                onClick={handleNotifyConfirmNo}
              >
                No
              </button>
              <button
                type="button"
                className="cal-modal__btn cal-modal__btn--primary"
                onClick={handleNotifyConfirmYes}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Book-from-list confirm modal — for waitlist + parked drops */}
      {bookConfirm ? (
        <div className="cal-modal" role="dialog" aria-modal="true">
          <button
            className="cal-modal__backdrop"
            onClick={handleBookConfirmNo}
            aria-label="Cancel"
          />
          <div className="cal-modal__card cal-confirm">
            <div className="cal-modal__title cal-confirm__time">
              {format(bookConfirm.start, "h:mm a")}
            </div>
            <div className="cal-confirm__body">
              {bookConfirm.kind === "waitlist"
                ? `Book ${bookConfirm.item.title} at this time?`
                : `Un-park ${bookConfirm.item.title} to this time?`}
            </div>
            <div className="cal-modal__row">
              <button
                type="button"
                className="cal-modal__btn cal-modal__btn--ghost"
                onClick={handleBookConfirmNo}
              >
                No
              </button>
              <button
                type="button"
                className="cal-modal__btn cal-modal__btn--primary"
                onClick={handleBookConfirmYes}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Floating ghost during parked drag — also portaled to <body>. */}
      {parkedDrag
        ? createPortal(
            <div
              className={`cal-apt cal-apt--ghost ${parkedDrag.item.fromMove ? "is-pink" : "is-gray"}`}
              style={{ left: parkedDrag.x, top: parkedDrag.y }}
              aria-hidden
            >
              <div className="cal-apt__client">{parkedDrag.item.title}</div>
              <div className="cal-apt__service">
                {parkedDrag.item.service || "Parked"}
              </div>
              <div className="cal-apt__time">60 min</div>
            </div>,
            document.body,
          )
        : null}

      {/* Reschedule modal */}
      {rescheduleApt ? (
        <RescheduleModal
          apt={rescheduleApt}
          onCancel={() => setRescheduleApt(null)}
          onConfirm={handleRescheduleConfirm}
        />
      ) : null}

      {/* Conflict resolver — per-occurrence free-slot picker */}
      {conflictItem ? (
        <ConflictResolverModal
          item={conflictItem}
          onPick={handlePickConflictSlot}
          onSkip={handleSkipConflict}
          onCancelAll={() => setConflictItem(null)}
        />
      ) : null}

      {/* New / Edit appointment overlay */}
      {newApptInit ? (
        <NewAppointmentOverlay
          initialStart={newApptInit}
          editing={editingApt}
          seedClientName={newApptSeedClient || undefined}
          clients={clients}
          services={serviceCatalog}
          onAddClient={handleAddClient}
          onAddService={handleAddService}
          onCancel={() => {
            setNewApptInit(null);
            setEditingApt(null);
            setNewApptSeedClient(null);
          }}
          onSave={handleSaveAppointment}
        />
      ) : null}
    </div>
  );
}

const REPEAT_INTERVALS = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

function NewAppointmentOverlay({
  initialStart,
  editing,
  seedClientName,
  clients,
  services,
  onAddClient,
  onAddService,
  onCancel,
  onSave,
}) {
  // Try to match editing.clientName against the catalog when modifying
  const initialClient = useMemo(() => {
    if (editing) {
      return clients.find((c) => c.name === editing.clientName) || null;
    }
    if (seedClientName) {
      return clients.find((c) => c.name === seedClientName) || null;
    }
    return null;
  }, [editing, seedClientName, clients]);
  const initialService = useMemo(() => {
    if (!editing) return null;
    return services.find((s) => s.name === editing.service) || null;
  }, [editing, services]);

  const [selectedClient, setSelectedClient] = useState(initialClient);
  const [clientName, setClientName] = useState(editing?.clientName || seedClientName || "");
  const [selectedService, setSelectedService] = useState(initialService);
  const [serviceName, setServiceName] = useState(editing?.service || "");
  const [time, setTime] = useState(format(initialStart, "HH:mm"));
  const [durationMin, setDurationMin] = useState(
    editing ? Math.max(5, differenceInMinutes(editing.end, editing.start)) : 60,
  );
  const [color, setColor] = useState(editing?.color || "blue");
  const [price, setPrice] = useState(editing?.price ?? "");
  const [notes, setNotes] = useState(editing?.notes || "");

  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatInterval, setRepeatInterval] = useState("week");
  const [repeatCount, setRepeatCount] = useState(4);

  // Sub-overlay state: 'pickClient' | 'pickService' | 'newClient' | 'newService' | null
  const [subOverlay, setSubOverlay] = useState(null);
  const [pendingNewName, setPendingNewName] = useState("");

  const handleClientSelect = (c) => {
    setSelectedClient(c);
    setClientName(c.name);
    setSubOverlay(null);
  };
  const handleServiceSelect = (s) => {
    setSelectedService(s);
    setServiceName(s.name);
    if (typeof s.price === "number") setPrice(s.price);
    if (typeof s.duration === "number") setDurationMin(s.duration);
    setSubOverlay(null);
  };
  const handleClientCreated = (c) => {
    onAddClient(c);
    handleClientSelect(c);
  };
  const handleServiceCreated = (s) => {
    onAddService(s);
    handleServiceSelect(s);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const [hh, mm] = (time || "00:00").split(":").map((s) => parseInt(s, 10) || 0);
    const start = new Date(initialStart);
    start.setHours(hh, mm, 0, 0);
    onSave({
      clientName,
      service: serviceName,
      start,
      durationMinutes: clamp(parseInt(durationMin, 10) || 0, 5, 12 * 60),
      color,
      price: typeof price === "number" ? price : Number(price) || 0,
      notes,
      repeat: {
        enabled: repeatEnabled,
        interval: repeatInterval,
        count: clamp(parseInt(repeatCount, 10) || 1, 1, 24),
      },
    });
  };

  return (
    <>
      <div className="cal-modal cal-modal--full" role="dialog" aria-modal="true">
        <button type="button" className="cal-modal__backdrop" onClick={onCancel} aria-label="Close" />
        <form className="cal-modal__card cal-modal__card--form" onSubmit={handleSubmit}>
          <div className="cal-modal__formHead">
            <div className="cal-modal__title">
              {editing ? "Modify Appointment" : "New Appointment"}
            </div>
            <button
              type="button"
              className="cal-modal__iconBtn"
              aria-label="Close"
              onClick={onCancel}
            >
              <X size={16} weight="bold" aria-hidden />
            </button>
          </div>
          <div className="cal-modal__formDate">{format(initialStart, "EEEE, MMM d")}</div>

          <div className="cal-field">
            <span className="cal-field__label">Client</span>
            <PickerTrigger
              value={clientName}
              placeholder="Select client"
              onClick={() => setSubOverlay("pickClient")}
            />
          </div>

          <div className="cal-field">
            <span className="cal-field__label">Service</span>
            <PickerTrigger
              value={serviceName}
              placeholder="Select service"
              onClick={() => setSubOverlay("pickService")}
            />
          </div>

          <div className="cal-fieldRow">
            <label className="cal-field">
              <span className="cal-field__label">Start</span>
              <input
                type="time"
                className="cal-field__input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                step={300}
                required
              />
            </label>
            <label className="cal-field">
              <span className="cal-field__label">Duration (min)</span>
              <input
                type="number"
                className="cal-field__input"
                min={5}
                max={720}
                step={5}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                required
              />
            </label>
          </div>

          <label className="cal-field">
            <span className="cal-field__label">Price ($)</span>
            <input
              type="number"
              className="cal-field__input"
              min={0}
              step={5}
              value={price}
              onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="0"
            />
          </label>

          <div className="cal-field">
            <span className="cal-field__label">Color</span>
            <div className="cal-colorRow">
              {COLOR_OPTIONS.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={`cal-colorChip ${color === c.id ? "is-active" : ""}`}
                  style={{ ["--swatch"]: c.swatch }}
                  aria-label={c.label}
                  onClick={() => setColor(c.id)}
                />
              ))}
            </div>
          </div>

          <label className="cal-field">
            <span className="cal-field__label">Notes</span>
            <textarea
              className="cal-field__input cal-field__textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              placeholder="Anything to remember…"
              rows={2}
              maxLength={500}
            />
            <span className="cal-field__counter">{notes.length}/500</span>
          </label>

          <div className="cal-field">
            <div className="cal-toggleRow">
              <span className="cal-field__label">Repeat</span>
              <button
                type="button"
                className={`cal-toggle${repeatEnabled ? " is-on" : ""}`}
                aria-pressed={repeatEnabled}
                onClick={() => setRepeatEnabled((v) => !v)}
              >
                <span className="cal-toggle__knob" />
              </button>
            </div>
            {repeatEnabled ? (
              <div className="cal-repeatBlock">
                <div className="cal-segment">
                  {REPEAT_INTERVALS.map((opt) => (
                    <button
                      type="button"
                      key={opt.id}
                      className={`cal-segment__opt${repeatInterval === opt.id ? " is-active" : ""}`}
                      onClick={() => setRepeatInterval(opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <label className="cal-field cal-field--inline">
                  <span className="cal-field__label">Number of times</span>
                  <input
                    type="number"
                    className="cal-field__input"
                    min={1}
                    max={24}
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(e.target.value)}
                  />
                </label>
              </div>
            ) : null}
          </div>

          <div className="cal-modal__row">
            <button
              type="button"
              className="cal-modal__btn cal-modal__btn--ghost"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button type="submit" className="cal-modal__btn cal-modal__btn--primary">
              {editing ? "Save" : "Book"}
            </button>
          </div>
        </form>
      </div>

      {subOverlay === "pickClient" ? (
        <SearchablePickerModal
          title="Select client"
          items={clients}
          renderItem={(c) => (
            <span className="cal-pickerItem__row">
              <span className="cal-pickerItem__name">{c.name}</span>
              {c.phone ? <span className="cal-pickerItem__sub">{c.phone}</span> : null}
            </span>
          )}
          onSelect={handleClientSelect}
          onAddNew={(typed) => {
            setPendingNewName(typed || "");
            setSubOverlay("newClient");
          }}
          addNewLabel="+ Add new client"
          onClose={() => setSubOverlay(null)}
        />
      ) : null}

      {subOverlay === "pickService" ? (
        <SearchablePickerModal
          title="Select service"
          items={services}
          renderItem={(s) => (
            <span className="cal-pickerItem__row">
              <span className="cal-pickerItem__name">{s.name}</span>
              {typeof s.price === "number" ? (
                <span className="cal-pickerItem__sub">${s.price}</span>
              ) : null}
            </span>
          )}
          onSelect={handleServiceSelect}
          onAddNew={(typed) => {
            setPendingNewName(typed || "");
            setSubOverlay("newService");
          }}
          addNewLabel="+ Add new service"
          onClose={() => setSubOverlay(null)}
        />
      ) : null}

      {subOverlay === "newClient" ? (
        <NewCustomerScreen
          initialName={pendingNewName}
          onCancel={() => setSubOverlay("pickClient")}
          onSave={handleClientCreated}
        />
      ) : null}

      {subOverlay === "newService" ? (
        <NewServiceScreen
          initialName={pendingNewName}
          onCancel={() => setSubOverlay("pickService")}
          onSave={handleServiceCreated}
        />
      ) : null}
    </>
  );
}

// ---------- Phase 4 — Reschedule modal (weeks + repeat selectors) ----------

const RESCHEDULE_WEEK_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const RESCHEDULE_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function RescheduleModal({ apt, onCancel, onConfirm }) {
  const [weeks, setWeeks] = useState(1);
  const [count, setCount] = useState(1);

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm({ weeks, count });
  };

  return (
    <div className="cal-modal cal-modal--full" role="dialog" aria-modal="true">
      <button type="button" className="cal-modal__backdrop" onClick={onCancel} aria-label="Close" />
      <form className="cal-modal__card cal-modal__card--form" onSubmit={handleSubmit}>
        <div className="cal-modal__formHead">
          <div className="cal-modal__title">Reschedule appointment</div>
          <button type="button" className="cal-modal__iconBtn" aria-label="Close" onClick={onCancel}>
            <X size={16} weight="bold" aria-hidden />
          </button>
        </div>
        <div className="cal-modal__formDate">
          {apt.clientName} • {format(apt.start, "EEE, MMM d • h:mm a")}
        </div>

        <div className="cal-field">
          <span className="cal-field__label">Every</span>
          <div className="cal-chipRow">
            {RESCHEDULE_WEEK_OPTIONS.map((w) => (
              <button
                type="button"
                key={w}
                className={`cal-chip${weeks === w ? " is-active" : ""}`}
                onClick={() => setWeeks(w)}
              >
                {w}w
              </button>
            ))}
          </div>
        </div>

        <div className="cal-field">
          <span className="cal-field__label">Repeat appointments</span>
          <div className="cal-chipRow">
            {RESCHEDULE_COUNT_OPTIONS.map((n) => (
              <button
                type="button"
                key={n}
                className={`cal-chip${count === n ? " is-active" : ""}`}
                onClick={() => setCount(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="cal-helperText">
          BOOK will schedule {count} appointment{count > 1 ? "s" : ""} every {weeks} week
          {weeks > 1 ? "s" : ""}.
        </div>

        <div className="cal-modal__row">
          <button type="button" className="cal-modal__btn cal-modal__btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="cal-modal__btn cal-modal__btn--primary">
            BOOK
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------- Phase 4 — Conflict resolver (per-occurrence free-slot picker) ----------

function ConflictResolverModal({ item, onPick, onSkip, onCancelAll }) {
  const { current, suggestions, remaining } = item;
  return (
    <div className="cal-modal cal-modal--picker" role="dialog" aria-modal="true">
      <button className="cal-modal__backdrop" onClick={onCancelAll} aria-label="Close" />
      <div className="cal-modal__card cal-modal__card--picker">
        <div className="cal-modal__formHead">
          <div>
            <div className="cal-modal__title">Conflict on {format(current.start, "EEE, MMM d")}</div>
            <div className="cal-modal__subtitle" style={{ textAlign: "left", marginTop: 4 }}>
              Requested {format(current.start, "h:mm a")} – {format(current.end, "h:mm a")} •{" "}
              {remaining.length} more to resolve
            </div>
          </div>
          <button type="button" className="cal-modal__iconBtn" aria-label="Close" onClick={onCancelAll}>
            <X size={16} weight="bold" aria-hidden />
          </button>
        </div>

        <div className="cal-conflictGrid">
          {suggestions.length === 0 ? (
            <div className="cal-pickerEmpty">No free slots — skip this one</div>
          ) : (
            suggestions.map((slot) => (
              <button
                type="button"
                key={slot.toISOString()}
                className="cal-conflictSlot"
                onClick={() => onPick(slot)}
              >
                {format(slot, "h:mm a")}
              </button>
            ))
          )}
        </div>

        <div className="cal-modal__row">
          <button type="button" className="cal-modal__btn cal-modal__btn--ghost" onClick={onSkip}>
            Skip this occurrence
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Phase 4 — Decorative right-side date stamp + soft accents ----------

// The right-side date stamp is fixed to *today's* actual date — it does not
// follow the navigated date in the calendar header. Tap it to jump back to today.
function CalendarDecorations({ onGoToToday }) {
  const today = new Date();
  return (
    <>
      <div className="cal-deco cal-deco--topRightCurve" aria-hidden>
        <svg
          width="40"
          height="100"
          viewBox="0 0 99 216"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M25.2381 94.5C-5.77198 68 1.82035 1 1.82035 1H47.3204H97.8204V235.5L90.8169 190C80.6496 135 56.2482 121 25.2381 94.5Z"
            fill="#1F1C1C"
            stroke="var(--salonx-primary)"
            strokeWidth="2"
            vectorEffect="nonScalingStroke"
          />
        </svg>
      </div>
      <button
        type="button"
        className="cal-deco cal-deco--rightStamp"
        onClick={onGoToToday}
        aria-label="Go to today"
      >
        <div className="cal-deco__stampDow">{format(today, "EEE").toUpperCase()}</div>
        <div className="cal-deco__stampNum">{format(today, "d")}</div>
      </button>
    </>
  );
}
