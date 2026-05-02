import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Butterfly,
  CalendarBlank,
  Camera,
  Clock,
  Lightning,
  Microphone,
  Minus,
  PencilSimple,
  Plus,
  Scissors,
  User,
  X,
} from 'phosphor-react';
import { MOCK_CLIENTS } from '../../data/mockClients';
import { MOCK_PRODUCTS } from '../../data/mockProducts';
import { MOCK_SERVICES } from '../../data/mockServices';
import './s2.css';
import './consultationBrief.css';

const S2_ICON_TOOLBAR = 24;
const S2_ICON_TOOLBAR_ACTIVE = 26;

const TOOLBAR_ACTIVE = 1;
const TOOLBAR_ITEMS = [
  { Icon: Scissors, label: 'Stylist', to: '/screen1' },
  { Icon: User, label: 'Client details', to: '/screen2' },
  { Icon: Lightning, label: 'Checkout', to: '/climax' },
  { Icon: CalendarBlank, label: 'Calendar', to: '/calendar' },
  { Icon: X, label: 'Home', to: '/' },
];

const CLIENT = {
  name: "Jon Klein",
  phone: "541-556-6923",
};

const META = {
  msgCount: 3,
};

const CONSULT = {
  lastVisitShort: '8.15.25',
  duration: '45 min',
  noteTag: 'YELLOW',
  noteHint: '"next time"',
  panes: [
    { key: 'LIFE', colorClass: 'is-life', text: 'Sister-in-law expecting twins · cabin rebuild · Jennifer→FSU' },
    { key: 'CHAIR', colorClass: 'is-chair', text: 'Redken Shades EQ 7N · 7WB · use more 7N next time' },
    { key: 'PATH', colorClass: 'is-path', text: 'Keep dimension · low maintenance · natural grow-out' },
    { key: 'LOOK', colorClass: 'is-look', text: null },
  ],
  lookThumbs: [
    { label: 'NOW', tone: 'now' },
    { label: 'WANT', tone: 'want' },
    { label: 'LAST', tone: 'last' },
  ],
  lookExtraCount: 2,
};

/** Adjustable dollar fields: $0–$310, $1 steps (hourly + consultation use same slider pattern) */
const ADJ_RATE_MIN = 0;
const ADJ_RATE_MAX = 310;

const SVC_HOURLY_BASE = { id: 'SVC-HOURLY', name: 'Hourly (stylist rate)', kind: 'hourly' };
const SVC_CONSULT_BASE = { id: 'SVC-CONSULT', name: 'Consultation', kind: 'consult' };

function clampAdjustableRate(n) {
  const v = Math.round(Number(n));
  if (Number.isNaN(v)) return 0;
  return Math.min(ADJ_RATE_MAX, Math.max(ADJ_RATE_MIN, v));
}

const SVC_VISUAL_GRADIENTS = [
  'linear-gradient(165deg, #3d2418 0%, #0a0a0c 88%)',
  'linear-gradient(165deg, #2a1824 0%, #0a0a0c 88%)',
  'linear-gradient(165deg, #1e2830 0%, #0a0a0c 88%)',
  'linear-gradient(165deg, #2a3020 0%, #0a0a0c 88%)',
  'linear-gradient(165deg, #302018 0%, #0a0a0c 88%)',
  'linear-gradient(165deg, #252030 0%, #0a0a0c 88%)',
];

function svcGradientForIndex(i) {
  return SVC_VISUAL_GRADIENTS[i % SVC_VISUAL_GRADIENTS.length];
}

function svcGradientForPickerId(id, pickerList) {
  const ix = pickerList.findIndex((x) => x.id === id);
  return svcGradientForIndex(ix >= 0 ? ix : 0);
}

/** Queue “deck” cards (reference UI): category line + duration heuristics from name */
function inferSvcDeckCategory(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.includes('haircut') || lower.includes("kids'")) return 'CUT';
  if (
    lower.includes('color') ||
    lower.includes('balayage') ||
    lower.includes('highlight') ||
    lower.includes('gloss') ||
    lower.includes('toner') ||
    lower.includes('camouflage')
  ) {
    return 'COLOR';
  }
  if (lower.includes('blowout') || lower.includes('iron') || lower.includes('upd')) return 'STYLE';
  if (
    lower.includes('treatment') ||
    lower.includes('repair') ||
    lower.includes('keratin') ||
    lower.includes('brazilian') ||
    lower.includes('scalp') ||
    lower.includes('perm') ||
    lower.includes('conditioning')
  ) {
    return 'TREAT';
  }
  if (lower.includes('beard') || lower.includes('buzz') || lower.includes('bang')) return 'GROOM';
  if (lower.includes('extension') || lower.includes('bridal') || lower.includes('trial')) return 'EVENT';
  return 'SERVICE';
}

/** Short primary label (orange in quad tiles) — matches reference “COLOR SERVICE” style */
function svcRefHeadline(name) {
  const c = inferSvcDeckCategory(name);
  const labels = {
    CUT: 'CUT',
    COLOR: 'COLOR',
    STYLE: 'STYLE',
    TREAT: 'TREATMENT',
    GROOM: 'GROOM',
    EVENT: 'EVENT',
    SERVICE: 'SERVICE',
  };
  return labels[c] || c;
}

function svcQuadHeadline(s) {
  if (!s) return '';
  if (s.id === 'SVC-HOURLY' || s.kind === 'hourly') return 'HOURLY';
  if (s.id === 'SVC-CONSULT' || s.kind === 'consult') return 'CONSULT';
  return svcRefHeadline(s.name);
}

function inferSvcDurationMinutes(name) {
  const lower = String(name || '').toLowerCase();
  if ((lower.includes('bang') || lower.includes('beard')) && !lower.includes('haircut')) return 20;
  if (lower.includes('kids')) return 30;
  if (lower.includes('buzz')) return 25;
  if (lower.includes('full balayage') || lower.includes('keratin') || lower.includes('brazilian') || lower.includes('tape-in')) {
    return 180;
  }
  if (lower.includes('partial high') || lower.includes('full high') || lower.includes('double process')) return 150;
  if (lower.includes('haircut') && !lower.includes('style')) return 45;
  if (lower.includes('haircut')) return 60;
  if (lower.includes('color') || lower.includes('blowout')) return 75;
  return 60;
}

function formatSvcDurationShort(name) {
  const m = inferSvcDurationMinutes(name);
  if (m >= 60 && m % 60 === 0) return `${m / 60}h`;
  if (m > 60) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h}h${r}m` : `${h}h`;
  }
  return `${m}m`;
}

/** Hourly + consultation always first on card + queue footer */
function sortSvcQueueForDisplay(queue) {
  const hourly = queue.find((s) => s.id === 'SVC-HOURLY');
  const consult = queue.find((s) => s.id === 'SVC-CONSULT');
  const rest = queue.filter((s) => s.id !== 'SVC-HOURLY' && s.id !== 'SVC-CONSULT');
  return [hourly, consult, ...rest].filter(Boolean);
}

function queuePriceLabel(s) {
  if (s.id === 'SVC-HOURLY' || s.kind === 'hourly') return `$${s.price}/hr`;
  if (String(s.id).startsWith('SVC-C')) return `$${s.price}/hr`;
  return `$${s.price}`;
}

const ADD_PRODUCTS_BRAND = 'DANGER JONES';

function productVisualGradient(color) {
  return `linear-gradient(165deg, ${color} 0%, #0a0a0c 85%)`;
}

// ---------- Consultation persistence (per-client, localStorage) ----------
const CONSULT_STORAGE_KEY = '@salonx/consultations/v1';
const CONSULT_DEFAULT_TEXT = {
  LIFE: 'Sister-in-law expecting twins · cabin rebuild · Jennifer→FSU',
  CHAIR: 'Redken Shades EQ 7N · 7WB · use more 7N next time',
  PATH: 'Keep dimension · low maintenance · natural grow-out',
};

function loadConsultStore() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CONSULT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}
function saveConsultStore(store) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONSULT_STORAGE_KEY, JSON.stringify(store));
  } catch (_) {
    /* noop */
  }
}
function clientKey(name) {
  return (name || '').trim().toLowerCase();
}

/** React Router drops `location.state` on full page refresh — keep last apt in-session so LOOK photos / consult load the right client. */
const SCREEN2_APT_SESSION_KEY = '@salonx/screen2LastApt/v1';

function readPersistedScreen2Apt() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SCREEN2_APT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && parsed.apt ? parsed.apt : null;
  } catch (_) {
    return null;
  }
}

function writePersistedScreen2Apt(apt) {
  if (typeof window === 'undefined' || !apt) return;
  try {
    sessionStorage.setItem(SCREEN2_APT_SESSION_KEY, JSON.stringify({ apt }));
  } catch (_) {
    /* noop */
  }
}
// Each pane (LIFE/CHAIR/PATH) stores a chronological log of notes — newest
// entry first. The legacy single-string field (e.g. `rec.LIFE`) is kept for
// backward compatibility and migrated into the entries array on first read.
function migratePaneEntries(rec, key) {
  const arr = rec[key + '_entries'];
  if (Array.isArray(arr) && arr.length) {
    return arr
      .filter((e) => e && typeof e.text === 'string' && e.text.trim())
      .map((e) => ({ text: e.text, ts: typeof e.ts === 'number' ? e.ts : Date.now() }));
  }
  const legacy = typeof rec[key] === 'string' ? rec[key].trim() : '';
  if (legacy) {
    return [{ text: legacy, ts: typeof rec.updatedAt === 'number' ? rec.updatedAt : Date.now() }];
  }
  return [];
}

function getConsultRecord(store, name) {
  const key = clientKey(name);
  const rec = store[key] || {};
  return {
    LIFE: typeof rec.LIFE === 'string' ? rec.LIFE : CONSULT_DEFAULT_TEXT.LIFE,
    CHAIR: typeof rec.CHAIR === 'string' ? rec.CHAIR : CONSULT_DEFAULT_TEXT.CHAIR,
    PATH: typeof rec.PATH === 'string' ? rec.PATH : CONSULT_DEFAULT_TEXT.PATH,
    LIFE_entries: migratePaneEntries(rec, 'LIFE'),
    CHAIR_entries: migratePaneEntries(rec, 'CHAIR'),
    PATH_entries: migratePaneEntries(rec, 'PATH'),
    photos: Array.isArray(rec.photos) ? rec.photos : [], // [{ url, ts, label }]
    avatar: typeof rec.avatar === 'string' && rec.avatar ? rec.avatar : null,
    updatedAt: rec.updatedAt || null,
  };
}

// Format a timestamp like "MAY 1 · 9:42 PM"
function formatNoteStamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${months[d.getMonth()]} ${d.getDate()} · ${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Compact date for note rows: 3.18.25 */
function formatNoteDateShort(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getMonth() + 1}.${d.getDate()}.${String(d.getFullYear()).slice(-2)}`;
}

function monthsSinceOldestEntry(entries) {
  if (!Array.isArray(entries) || !entries.length) return null;
  const oldest = entries.reduce((min, e) => Math.min(min, e.ts || Date.now()), entries[0].ts);
  const mo = (Date.now() - oldest) / (1000 * 60 * 60 * 24 * 30);
  return Math.max(1, Math.round(mo));
}

function visitOrdinalLabel(lifeEntryCount, isNewClient) {
  if (isNewClient) return '1ST VISIT';
  const n = Math.min(99, Math.max(2, 2 + lifeEntryCount));
  const map = { 1: '1ST', 2: '2ND', 3: '3RD', 4: '4TH', 5: '5TH', 6: '6TH', 7: '7TH', 8: '8TH', 9: '9TH', 10: '10TH' };
  return `${map[n] || `${n}TH`} VISIT`;
}

/** Storage is newest-first; prototype shows oldest→newest with latest at bottom */
function chronologicalForFeed(entries, fallbackText) {
  if (Array.isArray(entries) && entries.length) {
    return [...entries].reverse();
  }
  if (fallbackText && String(fallbackText).trim()) {
    return [{ text: String(fallbackText).trim(), ts: null }];
  }
  return [];
}

// Same key / event as Calendar.jsx — service list in picker stays in sync when
// catalog changes (new service from Calendar, etc.).
const CALENDAR_V1_STORAGE_KEY = '@salonx/calendar/v1';
const CALENDAR_UPDATED_EVENT = 'salonx:calendar-updated';

function normalizeServiceCatalogEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id != null ? String(raw.id) : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!id || !name) return null;
  const price = typeof raw.price === 'number' && !Number.isNaN(raw.price) ? raw.price : 0;
  return { id, name, price };
}

function loadServiceCatalogFromCalendarStorage() {
  if (typeof window === 'undefined') return MOCK_SERVICES;
  try {
    const json = window.localStorage.getItem(CALENDAR_V1_STORAGE_KEY);
    if (!json) return MOCK_SERVICES;
    const data = JSON.parse(json);
    const cat = data?.serviceCatalog;
    if (!Array.isArray(cat) || !cat.length) return MOCK_SERVICES;
    const normalized = cat.map(normalizeServiceCatalogEntry).filter(Boolean);
    return normalized.length ? normalized : MOCK_SERVICES;
  } catch {
    return MOCK_SERVICES;
  }
}

// ---------- Per-appointment services/products persistence ----------
// Each appointment has its own unique services + products + rate state, keyed
// by the appointment id from the Calendar event store. Nothing is shared
// between appointments — every appointment starts with an empty queue.
const APPT_STATE_STORAGE_KEY = '@salonx/appointmentState/v1';

function loadApptStateStore() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(APPT_STATE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}
function saveApptStateStore(store) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(APPT_STATE_STORAGE_KEY, JSON.stringify(store));
  } catch (_) {
    /* noop */
  }
}
function apptStateKey(apt) {
  if (!apt) return '';
  if (apt.id) return String(apt.id);
  // Fallback for legacy nav payloads without an id
  const start = apt.start ? new Date(apt.start).getTime() : '';
  return `${(apt.clientName || '').toLowerCase()}|${start}`;
}
function makeEmptySvcQueue() {
  return [
    { ...SVC_HOURLY_BASE, price: 0, kind: 'hourly' },
    { ...SVC_CONSULT_BASE, price: 0, kind: 'consult' },
  ];
}
function getApptState(store, apt) {
  const key = apptStateKey(apt);
  const rec = (key && store[key]) || {};
  return {
    svcQueue: Array.isArray(rec.svcQueue) && rec.svcQueue.length ? rec.svcQueue : makeEmptySvcQueue(),
    productQueue: Array.isArray(rec.productQueue) ? rec.productQueue : [],
    hourlyRate: typeof rec.hourlyRate === 'number' ? rec.hourlyRate : 0,
    consultRate: typeof rec.consultRate === 'number' ? rec.consultRate : 0,
  };
}

// Web Speech API factory — returns recognition instance or null if unsupported
function createRecognition() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.continuous = true;
  r.interimResults = true;
  r.lang = 'en-US';
  return r;
}

export default function Screen2() {
  const navigate = useNavigate();
  const location = useLocation();

  // Resolve appointment + client from nav state (Calendar single-tap passes `apt`).
  // After a full refresh, `state` is gone — fall back to last apt saved for this tab.
  const activeAptFromNav = location?.state?.apt || null;
  const activeApt = activeAptFromNav || readPersistedScreen2Apt() || null;

  useEffect(() => {
    if (activeAptFromNav) writePersistedScreen2Apt(activeAptFromNav);
  }, [activeAptFromNav]);

  const activeClientName = useMemo(() => {
    const fromNav = activeApt?.clientName;
    return (fromNav && String(fromNav).trim()) || CLIENT.name;
  }, [activeApt]);

  // Match against owner's MOCK_CLIENTS by case-insensitive name to enrich
  // the header (phone / email / etc). Falls back gracefully if not found.
  const activeClient = useMemo(() => {
    const target = activeClientName.toLowerCase();
    const match = MOCK_CLIENTS.find(
      (c) => (c.name || '').toLowerCase() === target,
    );
    return match || { name: activeClientName, phone: '', email: '' };
  }, [activeClientName]);

  // Derived display values for the appointment we navigated from
  const activeApptInfo = useMemo(() => {
    if (!activeApt || !activeApt.start || !activeApt.end) return null;
    const start = new Date(activeApt.start);
    const end = new Date(activeApt.end);
    const dur = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    const dateShort = `${start.getMonth() + 1}.${start.getDate()}.${String(start.getFullYear()).slice(-2)}`;
    return {
      dateShort,
      durationLabel: dur ? `${dur} min` : '',
      service: activeApt.service || '',
    };
  }, [activeApt]);

  const isNewClient = useMemo(() => {
    const target = activeClientName.toLowerCase();
    return !MOCK_CLIENTS.some((c) => (c.name || '').toLowerCase() === target);
  }, [activeClientName]);

  // Consultation notes per client, persisted to localStorage
  const [consultRecord, setConsultRecord] = useState(() =>
    getConsultRecord(loadConsultStore(), activeClientName),
  );

  // Reload record if active client changes
  useEffect(() => {
    setConsultRecord(getConsultRecord(loadConsultStore(), activeClientName));
  }, [activeClientName]);

  // Debounced persistence
  const consultRecordRef = useRef(consultRecord);
  consultRecordRef.current = consultRecord;
  useEffect(() => {
    const t = setTimeout(() => {
      const store = loadConsultStore();
      store[clientKey(activeClientName)] = {
        ...consultRecordRef.current,
        updatedAt: Date.now(),
      };
      saveConsultStore(store);
    }, 250);
    return () => clearTimeout(t);
  }, [consultRecord, activeClientName]);

  // ---------- New-note popup (per pane) ----------
  // Tap the mic on a pane → opens a modal where the user composes a brand-new
  // note (typed and/or dictated). Pressing "Update" prepends it to the pane's
  // entries log. The pane area itself stays read-only & scrollable so the
  // stylist can swipe to see older notes without touching them.
  const [noteEditOpen, setNoteEditOpen] = useState(null); // 'LIFE' | 'CHAIR' | 'PATH' | null
  const [noteDraft, setNoteDraft] = useState('');

  const [consultOpen, setConsultOpen] = useState(false);
  const [preBriefOpen, setPreBriefOpen] = useState(false);
  const lifeFeedRef = useRef(null);
  const chairFeedRef = useRef(null);
  const pathFeedRef = useRef(null);
  const lookGalleryRef = useRef(null);

  const openNoteEditor = useCallback((paneKey) => {
    setNoteDraft('');
    setNoteEditOpen(paneKey);
  }, []);

  // ---------- Voice recording (Web Speech API) — into the new-note draft ----
  const [recordingPane, setRecordingPane] = useState(null); // pane key being dictated
  const recognitionRef = useRef(null);
  const recordBaselineRef = useRef(''); // draft text before recording started

  const stopVoice = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try { rec.onresult = null; rec.onerror = null; rec.onend = null; rec.stop(); } catch (_) { /* noop */ }
    }
    recognitionRef.current = null;
    setRecordingPane(null);
  }, []);

  const startVoice = useCallback((paneKey) => {
    const rec = createRecognition();
    if (!rec) return; // browser doesn't support — silently no-op
    recordBaselineRef.current = '';
    setNoteDraft((d) => {
      recordBaselineRef.current = d || '';
      return d;
    });
    rec.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      const baseline = recordBaselineRef.current || '';
      const sep = baseline && !baseline.endsWith(' ') ? ' ' : '';
      const next = baseline + sep + (final || interim);
      setNoteDraft(next.trim());
      if (final) recordBaselineRef.current = next.trim();
    };
    rec.onerror = () => stopVoice();
    rec.onend = () => {
      recognitionRef.current = null;
      setRecordingPane(null);
    };
    try {
      rec.start();
      recognitionRef.current = rec;
      setRecordingPane(paneKey);
    } catch (_) {
      stopVoice();
    }
  }, [stopVoice]);

  const toggleVoice = useCallback((paneKey) => {
    if (recordingPane === paneKey) {
      stopVoice();
    } else {
      if (recognitionRef.current) stopVoice();
      startVoice(paneKey);
    }
  }, [recordingPane, startVoice, stopVoice]);

  // Append the draft as a new entry on the active pane and close the editor.
  const submitNoteDraft = useCallback(() => {
    if (!noteEditOpen) return;
    const text = (noteDraft || '').trim();
    if (!text) {
      stopVoice();
      setNoteEditOpen(null);
      return;
    }
    const ts = Date.now();
    const key = noteEditOpen + '_entries';
    setConsultRecord((prev) => {
      const existing = Array.isArray(prev[key]) ? prev[key] : [];
      // Newest first
      return { ...prev, [key]: [{ text, ts }, ...existing] };
    });
    stopVoice();
    setNoteDraft('');
    setNoteEditOpen(null);
  }, [noteDraft, noteEditOpen, stopVoice]);

  const cancelNoteDraft = useCallback(() => {
    stopVoice();
    setNoteDraft('');
    setNoteEditOpen(null);
  }, [stopVoice]);

  const closeConsultBrief = useCallback(() => {
    stopVoice();
    setNoteDraft('');
    setNoteEditOpen(null);
    setPreBriefOpen(false);
    setConsultOpen(false);
  }, [stopVoice]);

  useEffect(() => {
    if (consultOpen) setPreBriefOpen(false);
  }, [consultOpen]);

  const lifeChron = useMemo(
    () =>
      chronologicalForFeed(
        consultRecord.LIFE_entries,
        !consultRecord.LIFE_entries?.length
          ? (consultRecord.LIFE || '').trim() || CONSULT_DEFAULT_TEXT.LIFE
          : '',
      ),
    [consultRecord],
  );

  const chairChron = useMemo(
    () =>
      chronologicalForFeed(
        consultRecord.CHAIR_entries,
        !consultRecord.CHAIR_entries?.length
          ? (consultRecord.CHAIR || '').trim() || CONSULT_DEFAULT_TEXT.CHAIR
          : '',
      ),
    [consultRecord],
  );

  const pathChron = useMemo(
    () =>
      chronologicalForFeed(
        consultRecord.PATH_entries,
        !consultRecord.PATH_entries?.length
          ? (consultRecord.PATH || '').trim() || CONSULT_DEFAULT_TEXT.PATH
          : '',
      ),
    [consultRecord],
  );

  const photosChron = useMemo(() => {
    const p = [...(consultRecord.photos || [])].filter((x) => x && x.url);
    p.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    return p;
  }, [consultRecord.photos]);

  const preSummary = useMemo(() => {
    const n = (activeApt?.notes && String(activeApt.notes).trim()) || '';
    const svc = activeApt?.service ? String(activeApt.service).trim() : '';
    let s = '';
    if (n && svc) s = `${n} · ${svc}`;
    else s = n || svc || (isNewClient ? 'New appointment — screening & intake' : 'No pre-visit notes yet');
    return s.length > 64 ? `${s.slice(0, 64)}…` : s;
  }, [activeApt, isNewClient]);

  const prePillKind = CONSULT.noteTag === 'YELLOW' ? 'alert' : isNewClient ? 'new' : 'returning';

  const returningSuffix = useMemo(() => {
    const mo = monthsSinceOldestEntry(consultRecord.LIFE_entries);
    if (isNewClient || !mo) return '';
    return ` · ${mo}MO`;
  }, [consultRecord.LIFE_entries, isNewClient]);

  const visitMetaLine = useMemo(
    () =>
      `${activeClient.phone || '—'} · ${visitOrdinalLabel(consultRecord.LIFE_entries?.length || 0, isNewClient)}`,
    [activeClient.phone, consultRecord.LIFE_entries, isNewClient],
  );

  const todayBriefLine = useMemo(() => {
    if (!activeApt?.start) return null;
    const s = new Date(activeApt.start);
    const parts = [activeApt.service || 'Appointment', activeApptInfo?.durationLabel, formatNoteStamp(s.getTime())].filter(
      Boolean,
    );
    return parts.join(' · ');
  }, [activeApt, activeApptInfo]);

  useLayoutEffect(() => {
    if (!consultOpen) return;
    requestAnimationFrame(() => {
      [lifeFeedRef, chairFeedRef, pathFeedRef].forEach((r) => {
        const el = r.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
      const g = lookGalleryRef.current;
      if (g) g.scrollLeft = g.scrollWidth;
    });
  }, [consultOpen, consultRecord.LIFE_entries, consultRecord.CHAIR_entries, consultRecord.PATH_entries, consultRecord.photos, preBriefOpen]);

  // Stop recording when consult popup unmounts
  useEffect(() => {
    if (!recognitionRef.current) return;
    return () => stopVoice();
  }, [stopVoice]);

  // ---------- Photo capture (LOOK pane) ----------
  const photoInputRef = useRef(null);
  const photoSlotRef = useRef(null); // index of slot being filled, or null = next free

  const openPhotoPicker = useCallback((slotIndex) => {
    photoSlotRef.current = typeof slotIndex === 'number' ? slotIndex : null;
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
      photoInputRef.current.click();
    }
  }, []);

  const handlePhotoChosen = useCallback((e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result;
      setConsultRecord((prev) => {
        const photos = Array.isArray(prev.photos) ? [...prev.photos] : [];
        const slot = photoSlotRef.current;
        const item = { url, ts: Date.now() };
        if (typeof slot === 'number' && slot >= 0 && slot < photos.length) {
          photos[slot] = { ...photos[slot], ...item };
        } else {
          photos.push(item);
        }
        return { ...prev, photos };
      });
    };
    reader.readAsDataURL(file);
  }, []);

  // ---------- Avatar capture (header circle) ----------
  const avatarInputRef = useRef(null);

  const openAvatarPicker = useCallback(() => {
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
      avatarInputRef.current.click();
    }
  }, []);

  const handleAvatarChosen = useCallback((e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result;
      setConsultRecord((prev) => ({ ...prev, avatar: typeof url === 'string' ? url : null }));
    };
    reader.readAsDataURL(file);
  }, []);

  const [addServicesOpen, setAddServicesOpen] = useState(false);
  const [addProductsOpen, setAddProductsOpen] = useState(false);
  const [rateEditOpen, setRateEditOpen] = useState(null);

  const [serviceCatalogList, setServiceCatalogList] = useState(loadServiceCatalogFromCalendarStorage);
  useEffect(() => {
    const sync = () => setServiceCatalogList(loadServiceCatalogFromCalendarStorage());
    window.addEventListener(CALENDAR_UPDATED_EVENT, sync);
    const onStorage = (e) => {
      if (e.key === CALENDAR_V1_STORAGE_KEY || e.key === null) sync();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CALENDAR_UPDATED_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (addServicesOpen) setServiceCatalogList(loadServiceCatalogFromCalendarStorage());
  }, [addServicesOpen]);

  // Per-appointment state (services / products / rates). Initialized from the
  // appointment id passed via location.state — every appointment has its own
  // unique queue. New (untracked) appointments start with an empty queue
  // (Hourly + Consultation only, both at $0).
  const initialApptState = useMemo(
    () => getApptState(loadApptStateStore(), activeApt),
    // We only read this once per apt id change. The effect below handles
    // refreshing state when navigating between appointments.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [hourlyRate, setHourlyRate] = useState(initialApptState.hourlyRate);
  const [consultRate, setConsultRate] = useState(initialApptState.consultRate);
  const [svcQueue, setSvcQueue] = useState(initialApptState.svcQueue);
  const [productQueue, setProductQueue] = useState(initialApptState.productQueue);

  // Reload per-appointment state whenever the active appointment id changes
  // (e.g. user taps a different appointment in the Calendar without unmounting
  // Screen2). Falls back to an empty queue for first-time appointments.
  const apptKey = apptStateKey(activeApt);
  useEffect(() => {
    const rec = getApptState(loadApptStateStore(), activeApt);
    setHourlyRate(rec.hourlyRate);
    setConsultRate(rec.consultRate);
    setSvcQueue(rec.svcQueue);
    setProductQueue(rec.productQueue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apptKey]);

  // Persist on any change (debounced) — but only when we have a key to persist
  // against. Visiting Screen2 without an appointment shouldn't pollute storage.
  useEffect(() => {
    if (!apptKey) return undefined;
    const handle = setTimeout(() => {
      const store = loadApptStateStore();
      store[apptKey] = {
        svcQueue,
        productQueue,
        hourlyRate,
        consultRate,
        updatedAt: Date.now(),
      };
      saveApptStateStore(store);
    }, 250);
    return () => clearTimeout(handle);
  }, [apptKey, svcQueue, productQueue, hourlyRate, consultRate]);
  const [dockOpen, setDockOpen] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(null);

  const grabberTouch = useRef({ y: 0 });
  const navTouch = useRef({ x: 0, y: 0, skipFilmNav: false });

  const initials = useMemo(
    () =>
      (activeClient.name || '')
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
    [activeClient.name],
  );

  const displaySvcQueue = useMemo(() => sortSvcQueueForDisplay(svcQueue), [svcQueue]);

  const svcQuadPair = useMemo(
    () => [displaySvcQueue[0] ?? null, displaySvcQueue[1] ?? null],
    [displaySvcQueue],
  );

  const prdQuadPair = useMemo(() => [productQueue[0] ?? null, productQueue[1] ?? null], [productQueue]);

  const hourlySvc = useMemo(
    () => ({ ...SVC_HOURLY_BASE, price: hourlyRate, kind: 'hourly' }),
    [hourlyRate],
  );
  const consultSvc = useMemo(
    () => ({ ...SVC_CONSULT_BASE, price: consultRate, kind: 'consult' }),
    [consultRate],
  );
  const svcPickerList = useMemo(() => {
    const rest = serviceCatalogList.filter(
      (s) => s.id !== 'SVC-HOURLY' && s.id !== 'SVC-CONSULT',
    );
    return [hourlySvc, consultSvc, ...rest];
  }, [hourlySvc, consultSvc, serviceCatalogList]);

  useEffect(() => {
    setSvcQueue((prev) =>
      prev.map((s) => {
        if (s.id === 'SVC-HOURLY') return { ...s, price: hourlyRate };
        if (s.id === 'SVC-CONSULT') return { ...s, price: consultRate };
        return s;
      }),
    );
  }, [hourlyRate, consultRate]);

  const openRemoveConfirm = useCallback((kind, id, label) => {
    setRemoveConfirm({ kind, id, label });
  }, []);

  const handleConfirmRemove = useCallback(() => {
    if (!removeConfirm) return;
    if (removeConfirm.kind === 'svc') {
      setSvcQueue((prev) => prev.filter((q) => q.id !== removeConfirm.id));
    } else {
      setProductQueue((prev) => prev.filter((q) => q.id !== removeConfirm.id));
    }
    setRemoveConfirm(null);
  }, [removeConfirm]);

  const onGrabberTouchStart = useCallback((e) => {
    grabberTouch.current.y = e.touches[0].clientY;
  }, []);

  const onGrabberTouchEnd = useCallback((e) => {
    const y = e.changedTouches[0].clientY;
    const dy = grabberTouch.current.y - y;
    if (dy > 28) setDockOpen(true);
    if (dy < -28) setDockOpen(false);
  }, []);

  const onRootTouchStart = useCallback((e) => {
    if (consultOpen || addServicesOpen || addProductsOpen || rateEditOpen || removeConfirm) return;
    const t = e.touches[0];
    const el = e.target;
    const skipFilmNav =
      el &&
      typeof el.closest === 'function' &&
      Boolean(el.closest('.s2-filmCluster--queue') || el.closest('.s2-quadRow'));
    navTouch.current = { x: t.clientX, y: t.clientY, skipFilmNav };
  }, [addProductsOpen, addServicesOpen, consultOpen, rateEditOpen, removeConfirm]);

  const onRootTouchEnd = useCallback((e) => {
    if (consultOpen || addServicesOpen || addProductsOpen || rateEditOpen || removeConfirm) return;
    if (navTouch.current.skipFilmNav) return;
    const el = e.target;
    if (el && typeof el.closest === 'function') {
      if (el.closest('button, a, input, textarea, .s2-bottomDock, [role="dialog"]')) return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - navTouch.current.x;
    const dy = Math.abs(t.clientY - navTouch.current.y);
    if (Math.abs(dx) < 72 || dy > 48) return;
    if (dx > 0) navigate('/screen1');
    else navigate('/calendar');
  }, [addProductsOpen, addServicesOpen, consultOpen, navigate, rateEditOpen, removeConfirm]);

  return (
    <div
      className="s2-root"
      onTouchStart={onRootTouchStart}
      onTouchEnd={onRootTouchEnd}
    >
      <div className="s2-bg" />

      {/* TOP BAR */}
      <div className="s2-topbar">
        <button className="s2-back" onClick={() => navigate('/screen1')}>
          <span className="s2-back__chev" aria-hidden>‹</span>
          <span className="s2-back__label">Back</span>
        </button>
      </div>

      {/* AVATAR + IDENTITY */}
      <div className="s2-identity">
        <button
          type="button"
          className="s2-avatar"
          onClick={openAvatarPicker}
          aria-label={consultRecord.avatar ? 'Change client photo' : 'Add client photo'}
        >
          {consultRecord.avatar ? (
            <img
              src={consultRecord.avatar}
              alt={`${activeClient.name} photo`}
              className="s2-avatar__img"
              draggable={false}
            />
          ) : (
            <span className="s2-avatar__initials">{initials}</span>
          )}
        </button>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          aria-hidden
          tabIndex={-1}
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            border: 0,
            clip: 'rect(0 0 0 0)',
            overflow: 'hidden',
            opacity: 0,
            pointerEvents: 'none',
          }}
          onChange={handleAvatarChosen}
        />

        <div className="s2-identityRow">
          <div className="s2-msgBadges" aria-label="Unread messages">
            <div className="s2-msgBadge" aria-hidden>
              💬<span className="s2-msgBadge__count">{META.msgCount}</span>
          </div>
        </div>
          <div className="s2-clientName">{activeClient.name}</div>
          <div className="s2-clientPhone">
            {activeClient.phone || (isNewClient ? 'New client' : '')}
        </div>
          <button className="s2-kebabText" aria-label="More">⋮</button>
      </div>

        <div className="s2-progress" aria-label="Progress">
          <div className="s2-progressDots" aria-hidden>
            <span className="s2-pdot is-done" />
            <span className="s2-dotLine" />
            <span className="s2-pdot is-active" />
            <span className="s2-dotLine" />
            <span className="s2-pdot" />
            <span className="s2-dotLine" />
            <span className="s2-pdot" />
            <span className="s2-dotLine" />
            <span className="s2-pdot" />
          </div>
          <div className="s2-pdotLabels">
            <div className="s2-pdotLabel">CHECK</div>
            <div className="s2-pdotLabel is-active">CONSULT</div>
            <div className="s2-pdotLabel">SERVICE</div>
            <div className="s2-pdotLabel">LIFT</div>
            <div className="s2-pdotLabel">REBOOK</div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT — v1.3 stack */}
      <div className="s2-body">
        <div className="s2-section">
          <div className="s2-pill s2-pill--neutral">Consultation</div>
          <button type="button" className="s2-card s2-card--v13 s2-consultCard" onClick={() => setConsultOpen(true)} aria-label="Open consultation">
            <div className="s2-royBand is-yellow" aria-hidden />
            <div className="s2-consultHeader">
              <div className="s2-consultHeader__left">
                {activeApptInfo
                  ? `Appointment · ${activeApptInfo.dateShort}${
                      activeApptInfo.durationLabel ? ' · ' + activeApptInfo.durationLabel : ''
                    }`
                  : `Last visit · ${CONSULT.lastVisitShort} · ${CONSULT.duration}`}
              </div>
              <div className="s2-consultHeader__right">
                {activeApptInfo?.service ? activeApptInfo.service : `${CONSULT.noteTag} · ${CONSULT.noteHint} note`}
              </div>
            </div>

            <div className="s2-consultScroll">
              {CONSULT.panes.map((p) => (
                <div key={p.key} className="s2-pane">
                  <div className={`s2-paneLabel ${p.colorClass}`}>{p.key}</div>
                  {p.key !== 'LOOK' ? (
                    <div className="s2-paneContent">
                      {(consultRecord[p.key] || '').trim() || p.text || ''}
                    </div>
                  ) : (
                    <div className="s2-paneContent s2-lookStrip">
                      {(() => {
                        const photos = Array.isArray(consultRecord.photos)
                          ? consultRecord.photos
                          : [];
                        const tones = ['now', 'want', 'last'];
                        const items = [0, 1, 2].map((i) => ({
                          tone: tones[i],
                          label: tones[i].toUpperCase(),
                          url: photos[i]?.url || null,
                        }));
                        const extra = Math.max(0, photos.length - 3);
                        return (
                          <>
                            {items.map((t) => (
                              <div
                                key={t.label}
                                className={`s2-lookThumb is-${t.tone}`}
                                style={
                                  t.url
                                    ? {
                                        backgroundImage: `url(${t.url})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                      }
                                    : undefined
                                }
                              >
                                <div className="s2-lookThumb__tag">{t.label}</div>
                              </div>
                            ))}
                            {extra > 0 ? <div className="s2-lookMore">+{extra}</div> : null}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="s2-cardActions">
              <div className="s2-cardActions__hint">Add to consult</div>
              <div className="s2-cardActions__group">
                <button type="button" className="s2-actionBtn is-mic" onClick={(e) => { e.stopPropagation(); setConsultOpen(true); }} aria-label="Voice">
                  <span className="s2-actionBtn__ring" aria-hidden>
                    <Microphone size={15} weight="fill" />
                  </span>
                  <span className="s2-actionBtn__label">Voice</span>
                </button>
                <button type="button" className="s2-actionBtn is-cam" onClick={(e) => { e.stopPropagation(); setConsultOpen(true); }} aria-label="Photo">
                  <span className="s2-actionBtn__ring" aria-hidden>
                    <Camera size={15} weight="fill" />
                  </span>
                  <span className="s2-actionBtn__label">Photo</span>
                </button>
              </div>
            </div>
          </button>
        </div>

        <div className="s2-section">
          <div className="s2-pill s2-pill--neutral">Services</div>
          <div className="s2-card s2-card--v13 s2-svcCard">
            <div className="s2-quadRow" aria-label="Services">
              {[0, 1].map((ix) => {
                const s = svcQuadPair[ix];
                if (!s) {
                  return (
                    <button
                      key={`svc-slot-${ix}`}
                      type="button"
                      className="s2-quadCell s2-refTile s2-refTile--empty"
                      onClick={() => setAddServicesOpen(true)}
                      aria-label="Add service to this slot"
                    >
                      <span className="s2-refTile__emptyLabel">Tap to add</span>
                    </button>
                  );
                }
                const deckGrad = svcGradientForPickerId(s.id, svcPickerList);
                const isHourly = s.id === 'SVC-HOURLY' || s.kind === 'hourly';
                const isConsult = s.id === 'SVC-CONSULT' || s.kind === 'consult';
                return (
                  <div key={`${s.id}-quad-${ix}`} className="s2-quadCell s2-quadCell--filled">
            <button
              type="button"
                      className="s2-filmRemoveBtn"
                      aria-label={`Remove ${s.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openRemoveConfirm('svc', s.id, s.name);
                      }}
                    >
                      <Minus size={11} weight="bold" aria-hidden />
                    </button>
                    <div className="s2-svcDeckCard s2-svcDeckCard--quad" title={s.name}>
                      <button
                        type="button"
                        className="s2-svcDeckCard__edit"
                        aria-label={
                          isHourly
                            ? 'Set hourly rate'
                            : isConsult
                              ? 'Set consultation fee'
                              : `Edit services (${s.name})`
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isHourly) setRateEditOpen('hourly');
                          else if (isConsult) setRateEditOpen('consult');
                          else setAddServicesOpen(true);
                        }}
                      >
                        <PencilSimple size={9} weight="bold" aria-hidden />
                      </button>
                      <div className="s2-svcDeckCard__hero" style={{ background: deckGrad }} />
                      <span className="s2-svcDeckCard__accentBar" aria-hidden />
                      <div className="s2-svcDeckCard__body">
                        <div className="s2-svcDeckCard__headline">{svcQuadHeadline(s)}</div>
                        <div className="s2-svcDeckCard__subtitle">{s.name}</div>
                        <div className="s2-svcDeckCard__metaRow">
                          {isHourly ? (
                            <span className="s2-svcDeckCard__dur s2-svcDeckCard__dur--label">Time-based</span>
                          ) : isConsult ? (
                            <span className="s2-svcDeckCard__dur s2-svcDeckCard__dur--label">Session fee</span>
                          ) : (
                            <span className="s2-svcDeckCard__dur">
                              <Clock size={9} weight="bold" aria-hidden />
                              {formatSvcDurationShort(s.name)}
                            </span>
                          )}
        </div>
                      </div>
                      <span className="s2-svcDeckCard__bottomTick" aria-hidden />
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                className="s2-quadCell s2-refTile s2-refTile--suggested"
                onClick={() => setAddServicesOpen(true)}
                aria-label="Suggested services from catalog"
              >
                <span className="s2-refTile__badgeSuggested">SUGGESTED</span>
                <div className="s2-refTile__silhouette" aria-hidden />
                <div className="s2-refTile__suggestedMeta">
                  <span className="s2-refTile__suggestedTitle">From catalog</span>
                  <span className="s2-refTile__suggestedSub">Tap to browse</span>
                </div>
                <span className="s2-refTile__plusCorner" aria-hidden>
                  <Plus size={14} weight="bold" />
                </span>
              </button>
              <button
                type="button"
                className="s2-quadCell s2-refTile s2-refTile--add"
                onClick={() => setAddServicesOpen(true)}
                aria-label="Add service"
              >
                <Plus size={22} weight="regular" className="s2-refTile__addGlyph" aria-hidden />
                <span className="s2-refTile__addLabel">ADD SERVICE</span>
              </button>
            </div>
          </div>
        </div>

        <div className="s2-section">
          <div className="s2-pill s2-pill--neutral">BackBar / Finish</div>
          <div className="s2-card s2-card--v13 s2-hcCard">
            <div className="s2-quadRow" aria-label="Back bar and finish products">
              {[0, 1].map((ix) => {
                const p = prdQuadPair[ix];
                if (!p) {
                  return (
                    <button
                      key={`prd-slot-${ix}`}
                      type="button"
                      className="s2-quadCell s2-refTile s2-refTile--empty"
                      onClick={() => setAddProductsOpen(true)}
                      aria-label="Add product to this slot"
                    >
                      <span className="s2-refTile__emptyLabel">Tap to add</span>
                    </button>
                  );
                }
                const prdGrad = productVisualGradient(p.color || '#1a1612');
                return (
                  <div key={`${p.id}-pquad-${ix}`} className="s2-quadCell s2-quadCell--filled">
                <button
                  type="button"
                      className="s2-filmRemoveBtn"
                      aria-label={`Remove ${p.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openRemoveConfirm('product', p.id, `${p.brand} · ${p.name}`);
                      }}
                    >
                      <Minus size={11} weight="bold" aria-hidden />
                    </button>
                    <div className="s2-svcDeckCard s2-svcDeckCard--quad s2-svcDeckCard--product" title={p.name}>
                      <button
                        type="button"
                        className="s2-svcDeckCard__edit"
                        aria-label={`Edit products (${p.name})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddProductsOpen(true);
                        }}
                      >
                        <PencilSimple size={9} weight="bold" aria-hidden />
                      </button>
                      <div className="s2-svcDeckCard__hero" style={{ background: prdGrad }} />
                      <span className="s2-svcDeckCard__accentBar" aria-hidden />
                      <div className="s2-svcDeckCard__body">
                        <div className="s2-svcDeckCard__headline">{p.brand}</div>
                        <div className="s2-svcDeckCard__subtitle">{p.name}</div>
                      </div>
                      <span className="s2-svcDeckCard__bottomTick" aria-hidden />
                      </div>
                  </div>
                );
              })}
              <button
                type="button"
                className="s2-quadCell s2-refTile s2-refTile--suggested"
                onClick={() => setAddProductsOpen(true)}
                aria-label="Suggested back bar / finish"
              >
                <span className="s2-refTile__badgeSuggested">SUGGESTED</span>
                <div className="s2-refTile__silhouette" aria-hidden />
                <div className="s2-refTile__suggestedMeta">
                  <span className="s2-refTile__suggestedTitle">From catalog</span>
                  <span className="s2-refTile__suggestedSub">Tap to browse</span>
                </div>
                <span className="s2-refTile__plusCorner" aria-hidden>
                  <Plus size={14} weight="bold" />
                </span>
              </button>
              <button
                type="button"
                className="s2-quadCell s2-refTile s2-refTile--add"
                onClick={() => setAddProductsOpen(true)}
                aria-label="Add product"
              >
                <Plus size={22} weight="regular" className="s2-refTile__addGlyph" aria-hidden />
                <span className="s2-refTile__addLabel">ADD PRODUCT</span>
                </button>
              </div>
          </div>
        </div>
      </div>

      {/* End-of-visit: swipe up on grabber (or tap) — Rebook, Checkout, toolbar */}
      <div className={`s2-bottomDock${dockOpen ? ' is-expanded' : ' is-collapsed'}`}>
                <button
                  type="button"
          className="s2-bottomDock__grabber"
          aria-expanded={dockOpen}
          aria-label={dockOpen ? 'Collapse actions' : 'Expand Rebook, Checkout, and toolbar'}
          onClick={() => setDockOpen((v) => !v)}
          onTouchStart={onGrabberTouchStart}
          onTouchEnd={onGrabberTouchEnd}
        >
          <span className="s2-bottomDock__handle" aria-hidden />
          <span className="s2-bottomDock__hint">
            {dockOpen ? 'Swipe down · or tap to hide' : 'Swipe up · Rebook · Checkout · Tools'}
          </span>
        </button>
        <div className="s2-bottomDock__content">
          <div className="s2-ctaRow">
            <button type="button" className="s2-cta is-rebook">
              <div className="s2-ctaIcon" aria-hidden>↻</div>
              <div className="s2-ctaLabel">Rebook</div>
            </button>
            <button type="button" className="s2-cta is-checkout" onClick={() => navigate('/climax')}>
              <div className="s2-ctaIcon" aria-hidden><span className="s2-flagIcon" /></div>
              <div className="s2-ctaLabel">Check out</div>
                </button>
                      </div>
          <div className="s2-toolbar">
            {TOOLBAR_ITEMS.map(({ Icon, label, to }, i) => {
              const isActive = i === TOOLBAR_ACTIVE;
              return (
                <button
                  key={label}
                  type="button"
                  className={`s2-toolbar__btn${isActive ? ' s2-toolbar__btn--solid' : ''}`}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => navigate(to)}
                >
                  <Icon
                    size={isActive ? S2_ICON_TOOLBAR_ACTIVE : S2_ICON_TOOLBAR}
                    weight={isActive ? 'fill' : 'regular'}
                    aria-hidden
                  />
                </button>
              );
            })}
                      </div>
                      </div>
      </div>

      {consultOpen ? (
        <div className="nc-popup" role="dialog" aria-modal="true" aria-label="Consultation brief">
          <div className="nc-pu-top">
            <button type="button" className="nc-close-x" aria-label="Close" onClick={closeConsultBrief}>
              ✕
            </button>
            <div className="nc-pu-id">
              <div className="nc-pu-id-mini">
                {consultRecord.avatar ? (
                  <img src={consultRecord.avatar} alt="" draggable={false} />
                ) : (
                  initials
                )}
              </div>
              <div>
                <div className="nc-pu-name">{activeClient.name}</div>
                <div className="nc-pu-meta">{visitMetaLine}</div>
              </div>
            </div>
            <div className="nc-pu-spacer" aria-hidden />
          </div>

          <div
            className={`nc-preconsult${preBriefOpen ? ' open' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => setPreBriefOpen((o) => !o)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setPreBriefOpen((o) => !o);
              }
            }}
          >
            <div className="nc-pc-row">
              <div className="nc-pc-left">
                <div
                  className={`nc-pc-pill ${
                    prePillKind === 'alert' ? 'alert' : prePillKind === 'new' ? 'new' : 'returning'
                  }`}
                >
                  <span className="nc-dot" aria-hidden />
                  {prePillKind === 'alert'
                    ? 'ALERT · REVIEW'
                    : prePillKind === 'new'
                      ? 'NEW · INTAKE'
                      : `RETURNING${returningSuffix}`}
                </div>
                <div className="nc-pc-summary">{preSummary}</div>
              </div>
              <div className="nc-pc-icons">
                {photosChron.length > 0 ? (
                  <span className="nc-ico" aria-hidden>
                    📷 {photosChron.length}
                  </span>
                ) : null}
                <span className="nc-pc-chev" aria-hidden>
                  ▾
                </span>
              </div>
            </div>
            <div className="nc-pc-expand">
              <div
                className="nc-pc-expand-inner"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                role="presentation"
              >
                {photosChron.length > 0 ? (
                  <>
                    <div className="nc-pc-line">
                      <div className="nc-pc-glyph" aria-hidden>
                        📷
                      </div>
                      <div>
                        <b>{photosChron.length} photos</b>
                        <span className="nc-meta">
                          {photosChron.map((ph) => formatNoteDateShort(ph.ts)).join(' · ')}
                        </span>
                      </div>
                    </div>
                    <div className="nc-pc-thumbs">
                      {photosChron.map((ph, i) => (
                        <div
                          key={`${ph.ts}-${i}`}
                          className="nc-pc-thumb"
                          style={{ backgroundImage: ph.url ? `url(${ph.url})` : undefined }}
                          aria-hidden
                        />
                      ))}
                    </div>
                  </>
                ) : null}
                {activeApt?.notes ? (
                  <div className="nc-pc-line" style={{ marginTop: photosChron.length ? 6 : 0 }}>
                    <div className="nc-pc-glyph" aria-hidden>
                      ✎
                    </div>
                    <div>
                      <b>Booking:</b> {String(activeApt.notes)}
                    </div>
                  </div>
                ) : null}
                {CONSULT.noteTag === 'YELLOW' && CONSULT.noteHint ? (
                  <div className="nc-pc-line" style={{ marginTop: 6 }}>
                    <div className="nc-pc-glyph" style={{ color: 'var(--nc-alert-yellow)' }} aria-hidden>
                      ⚑
                    </div>
                    <div>
                      <div className="nc-pc-flag">
                        {CONSULT.noteTag} · {CONSULT.noteHint}
                      </div>
                    </div>
                  </div>
                ) : null}
                {todayBriefLine ? (
                  <div className="nc-pc-line" style={{ marginTop: 6 }}>
                    <div className="nc-pc-glyph" aria-hidden>
                      📅
                    </div>
                    <div>
                      <b>Today:</b> {todayBriefLine}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="nc-fields">
            <div className="nc-field">
              <div className="nc-f-head">
                <div className="nc-f-title">
                  <span className="nc-f-label life">LIFE</span>
                  <span className="nc-f-count">
                    {lifeChron.length} · {monthsSinceOldestEntry(consultRecord.LIFE_entries) || '—'}MO
                  </span>
                </div>
                <div className="nc-f-actions">
                  <button type="button" className="nc-f-btn" aria-label="Add LIFE note" onClick={() => openNoteEditor('LIFE')}>
                    <PencilSimple size={14} weight="bold" aria-hidden />
                  </button>
                  <button type="button" className="nc-f-btn" aria-label="Voice LIFE note" onClick={() => openNoteEditor('LIFE')}>
                    <Microphone size={14} weight="fill" aria-hidden />
                </button>
              </div>
            </div>
              <div className="nc-f-feed" ref={lifeFeedRef}>
                <div className="nc-f-spacer" aria-hidden />
                {lifeChron.length === 0 ? (
                  <div className="nc-note">
                    <div className="nc-ts">—</div>
                    <div className="nc-body">No notes yet — tap pencil or mic.</div>
                  </div>
                ) : (
                  lifeChron.map((entry, idx) => (
                    <div key={`${entry.ts}-${idx}`} className={`nc-note${idx === lifeChron.length - 1 ? ' latest' : ''}`}>
                      <div className="nc-ts">{entry.ts ? formatNoteDateShort(entry.ts) : '—'}</div>
                      <div className="nc-body">{entry.text}</div>
                    </div>
                  ))
                )}
              </div>
        </div>

            <div className="nc-field">
              <div className="nc-f-head">
                <div className="nc-f-title">
                  <span className="nc-f-label chair">CHAIR</span>
                  <span className="nc-f-count">FORMULA · {chairChron.length}</span>
                </div>
                <div className="nc-f-actions">
                  <button type="button" className="nc-f-btn" aria-label="Add CHAIR note" onClick={() => openNoteEditor('CHAIR')}>
                    <PencilSimple size={14} weight="bold" aria-hidden />
                  </button>
                  <button type="button" className="nc-f-btn" aria-label="Voice CHAIR note" onClick={() => openNoteEditor('CHAIR')}>
                    <Microphone size={14} weight="fill" aria-hidden />
                  </button>
                </div>
              </div>
              <div className="nc-f-feed" ref={chairFeedRef}>
                <div className="nc-f-spacer" aria-hidden />
                {chairChron.length === 0 ? (
                  <div className="nc-note">
                    <div className="nc-ts">—</div>
                    <div className="nc-body">No notes yet — tap pencil or mic.</div>
                  </div>
                ) : (
                  chairChron.map((entry, idx) => (
                    <div key={`${entry.ts}-${idx}`} className={`nc-note${idx === chairChron.length - 1 ? ' latest' : ''}`}>
                      <div className="nc-ts">{entry.ts ? formatNoteDateShort(entry.ts) : '—'}</div>
                      <div className="nc-body">{entry.text}</div>
                    </div>
                  ))
                )}
              </div>
      </div>

            <div className="nc-field">
              <div className="nc-f-head">
                <div className="nc-f-title">
                  <span className="nc-f-label path">PATH</span>
                  <span className="nc-f-count">DIRECTION</span>
                </div>
                <div className="nc-f-actions">
                  <button type="button" className="nc-f-btn" aria-label="Add PATH note" onClick={() => openNoteEditor('PATH')}>
                    <PencilSimple size={14} weight="bold" aria-hidden />
        </button>
                  <button type="button" className="nc-f-btn" aria-label="Voice PATH note" onClick={() => openNoteEditor('PATH')}>
                    <Microphone size={14} weight="fill" aria-hidden />
        </button>
                </div>
              </div>
              <div className="nc-f-feed" ref={pathFeedRef}>
                <div className="nc-f-spacer" aria-hidden />
                {pathChron.length === 0 ? (
                  <div className="nc-note">
                    <div className="nc-ts">—</div>
                    <div className="nc-body">No notes yet — tap pencil or mic.</div>
                  </div>
                ) : (
                  pathChron.map((entry, idx) => (
                    <div key={`${entry.ts}-${idx}`} className={`nc-note${idx === pathChron.length - 1 ? ' latest' : ''}`}>
                      <div className="nc-ts">{entry.ts ? formatNoteDateShort(entry.ts) : '—'}</div>
                      <div className="nc-body">{entry.text}</div>
                    </div>
                  ))
                )}
              </div>
      </div>

            <div className="nc-field nc-field--look">
              <div className="nc-f-head">
                <div className="nc-f-title">
                  <span className="nc-f-label look">LOOK</span>
                  <span className="nc-f-count">
                    {photosChron.length} PHOTOS · ↔ SCROLL
                  </span>
                </div>
                <div className="nc-f-actions">
                  <button type="button" className="nc-f-btn" aria-label="Add LOOK photo" onClick={() => openPhotoPicker(null)}>
                    <Camera size={14} weight="fill" aria-hidden />
                  </button>
                </div>
              </div>
              <div className="nc-look-gallery" ref={lookGalleryRef}>
                {photosChron.length === 0 ? (
                  <button type="button" className="nc-photo-card" onClick={() => openPhotoPicker(null)} aria-label="Add photo">
                    <div className="nc-photo-img nc-photo-add">+</div>
                    <div className="nc-photo-cap">add</div>
                  </button>
                ) : (
                  photosChron.map((ph, idx) => (
          <button
                      key={`${ph.ts}-${idx}`}
            type="button"
                      className={`nc-photo-card${idx === photosChron.length - 1 ? ' latest' : ''}`}
            onClick={() => {
                        const origIx = (consultRecord.photos || []).findIndex(
                          (p) => p && p.url === ph.url && (p.ts || 0) === (ph.ts || 0),
                        );
                        openPhotoPicker(origIx >= 0 ? origIx : null);
                      }}
                      aria-label={`Photo ${idx + 1}`}
                    >
                      <div className="nc-photo-img">
                        <img src={ph.url} alt="" draggable={false} />
                      </div>
                      <div className="nc-photo-cap">{ph.ts ? formatNoteDateShort(ph.ts) : '—'}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
              aria-hidden
            tabIndex={-1}
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              border: 0,
              clip: 'rect(0 0 0 0)',
              overflow: 'hidden',
              opacity: 0,
              pointerEvents: 'none',
            }}
            onChange={handlePhotoChosen}
          />
        </div>
      ) : null}

      {/* New-note composer — opens when the mic on a pane is tapped */}
      {noteEditOpen ? (
        <div className="s2-noteOverlay" role="dialog" aria-modal="true" aria-label={`New ${noteEditOpen} note`}>
          <button
            type="button"
            className="s2-noteBackdrop"
            aria-label="Cancel"
            onClick={cancelNoteDraft}
          />
          <div className="s2-noteSheet">
            <header className="s2-noteHeader">
              <div className={`s2-noteLabel ${
                noteEditOpen === 'LIFE' ? 'is-pink'
                : noteEditOpen === 'CHAIR' ? 'is-yellow'
                : 'is-green'
              }`}>{noteEditOpen}</div>
              <div className="s2-noteTitle">New note</div>
              <button
                type="button"
                className="s2-noteClose"
                aria-label="Cancel"
                onClick={cancelNoteDraft}
              >
                <X size={18} weight="regular" aria-hidden />
          </button>
            </header>

            <div className="s2-noteBody">
              <textarea
                className="s2-noteInput"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder={`Tap mic to dictate, or type a new ${noteEditOpen.toLowerCase()} note…`}
                autoFocus
                spellCheck={false}
              />
              <button
                type="button"
                className={`s2-noteMic${recordingPane === noteEditOpen ? ' is-recording' : ''}`}
                aria-label={recordingPane === noteEditOpen ? 'Stop dictation' : 'Start dictation'}
                aria-pressed={recordingPane === noteEditOpen}
                onClick={() => toggleVoice(noteEditOpen)}
              >
                <Microphone size={18} weight="fill" aria-hidden />
              </button>
      </div>

            <footer className="s2-noteFooter">
              <button
                type="button"
                className="s2-noteUpdate"
                disabled={!noteDraft.trim()}
                onClick={submitNoteDraft}
              >
                Update
            </button>
            </footer>
          </div>
        </div>
      ) : null}

      {addServicesOpen ? (
        <div className="s2-addProdOverlay" role="dialog" aria-modal="true" aria-label="Add services">
          <button
            type="button"
            className="s2-addProdBackdrop"
            aria-label="Close"
            onClick={() => setAddServicesOpen(false)}
          />
          <div className="s2-addProdSheet">
            <header className="s2-addProdHeader">
              <button
                type="button"
                className="s2-addProdClose"
                onClick={() => setAddServicesOpen(false)}
                aria-label="Close"
              >
                <X size={18} weight="regular" aria-hidden />
              </button>
              <div className="s2-svcPickBrand" aria-hidden>
                <Butterfly className="s2-svcPickButterfly" size={26} weight="fill" />
                <div className="s2-svcPickSalon">THE BUTTERFLY LOFT</div>
                <div className="s2-svcPickPowered">POWERED BY DANGER JONES</div>
              </div>
            </header>
            <div className="s2-addProdScroll">
              <div className="s2-addProdGrid">
                {svcPickerList.map((s, i) => {
                  const inQueue = svcQueue.some((q) => q.id === s.id);
                  const rowSvc =
                    s.id === 'SVC-HOURLY' ? hourlySvc : s.id === 'SVC-CONSULT' ? consultSvc : s;
                return (
                    <button
                      key={s.id}
                      type="button"
                      className={`s2-addProdCard s2-addProdCard--service${inQueue ? ' is-inQueue' : ''}`}
                      onClick={() => {
                        setSvcQueue((prev) =>
                          prev.some((q) => q.id === s.id)
                            ? prev.filter((q) => q.id !== s.id)
                            : [...prev, rowSvc],
                        );
                      }}
                    >
                      <div
                        className="s2-addProdCard__visual"
                        style={{ background: svcGradientForIndex(i) }}
                        aria-hidden
                      />
                      <div className="s2-addProdCard__meta">
                        <div className="s2-addProdCard__name s2-addProdCard__name--service">{rowSvc.name}</div>
                        <div className="s2-addProdCard__price">{queuePriceLabel(rowSvc)}</div>
                      </div>
                  </button>
                );
              })}
            </div>
          </div>
            <footer className="s2-svcPickQueue">
              <div className="s2-svcPickQueue__label">S2 QUEUE</div>
              <div className="s2-svcPickQueue__row">
                {displaySvcQueue.map((s, qi) => (
                  <div key={`${s.id}-${qi}`} className="s2-svcPickQueueCard">
                    <button
                      type="button"
                      className="s2-svcPickQueueCard__rm"
                      aria-label={`Remove ${s.name}`}
                      onClick={() => openRemoveConfirm('svc', s.id, s.name)}
                    >
                      <X size={10} weight="bold" aria-hidden />
                    </button>
                    <div
                      className="s2-svcPickQueueCard__thumb"
                      style={{ background: svcGradientForPickerId(s.id, svcPickerList) }}
                      aria-hidden
                    />
                    <div className="s2-svcPickQueueCard__meta">
                      <div className="s2-svcPickQueueCard__name">{s.name}</div>
                      <div className="s2-svcPickQueueCard__price">{queuePriceLabel(s)}</div>
        </div>
            </div>
                ))}
                <button
                  type="button"
                  className="s2-svcPickQueueAdd"
                  onClick={() =>
                    setSvcQueue((prev) => [
                      ...prev,
                      { id: `SVC-C-${Date.now()}`, name: 'Custom service', price: 0 },
                    ])
                  }
                >
                  <span className="s2-svcPickQueueAdd__plus" aria-hidden>
                    +
                  </span>
                  <span className="s2-svcPickQueueAdd__text">ADD CUSTOM SERVICE</span>
            </button>
          </div>
            </footer>
          </div>
        </div>
      ) : null}

      {addProductsOpen ? (
        <div className="s2-addProdOverlay" role="dialog" aria-modal="true" aria-label="Add products">
          <button
            type="button"
            className="s2-addProdBackdrop"
            aria-label="Close"
            onClick={() => setAddProductsOpen(false)}
          />
          <div className="s2-addProdSheet">
            <header className="s2-addProdHeader">
              <button
                type="button"
                className="s2-addProdClose"
                onClick={() => setAddProductsOpen(false)}
                aria-label="Close"
              >
                <X size={18} weight="regular" aria-hidden />
              </button>
              <div className="s2-addProdKicker">{ADD_PRODUCTS_BRAND}</div>
              <h2 className="s2-addProdTitle">ADD PRODUCTS</h2>
            </header>
            <div className="s2-addProdScroll">
              <div className="s2-addProdGrid">
                {MOCK_PRODUCTS.map((p) => {
                  const inQueue = productQueue.some((q) => q.id === p.id);
                return (
                  <button
                      key={p.id}
                      type="button"
                      className={`s2-addProdCard${inQueue ? ' is-inQueue' : ''}`}
                      onClick={() => {
                        setProductQueue((prev) =>
                          prev.some((q) => q.id === p.id)
                            ? prev.filter((q) => q.id !== p.id)
                            : [...prev, p],
                        );
                      }}
                    >
                      <div
                        className="s2-addProdCard__visual"
                        style={{ background: productVisualGradient(p.color) }}
                        aria-hidden
                      />
                      <div className="s2-addProdCard__meta">
                        <div className="s2-addProdCard__brand">{p.brand}</div>
                        <div className="s2-addProdCard__name">{p.name}</div>
                        <div className="s2-addProdCard__price">${p.price}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
            <footer className="s2-svcPickQueue s2-prodPickQueue">
              <div className="s2-svcPickQueue__label">BACKBAR / FINISH</div>
              <div className="s2-svcPickQueue__row">
                {productQueue.map((p, qi) => (
                  <div key={`${p.id}-${qi}`} className="s2-svcPickQueueCard">
                    <button
                      type="button"
                      className="s2-svcPickQueueCard__rm"
                      aria-label={`Remove ${p.name}`}
                      onClick={() => openRemoveConfirm('product', p.id, `${p.brand} · ${p.name}`)}
                    >
                      <X size={10} weight="bold" aria-hidden />
                    </button>
                    <div
                      className="s2-svcPickQueueCard__thumb"
                      style={{ background: productVisualGradient(p.color) }}
                      aria-hidden
                    />
                    <div className="s2-svcPickQueueCard__meta">
                      <div className="s2-svcPickQueueCard__brand">{p.brand}</div>
                      <div className="s2-svcPickQueueCard__name">{p.name}</div>
                      <div className="s2-svcPickQueueCard__price">${p.price}</div>
        </div>
                  </div>
                ))}
              </div>
            </footer>
          </div>
        </div>
      ) : null}

      {removeConfirm ? (
        <div className="s2-confirmOverlay" role="dialog" aria-modal="true" aria-labelledby="s2-remove-confirm-title">
          <button
            type="button"
            className="s2-addProdBackdrop"
            aria-label="Cancel"
            onClick={() => setRemoveConfirm(null)}
          />
          <div className="s2-confirmSheet">
            <h2 id="s2-remove-confirm-title" className="s2-confirmTitle">
              Remove this item?
            </h2>
            <p className="s2-confirmBody">{removeConfirm.label}</p>
            <div className="s2-confirmActions">
              <button type="button" className="s2-confirmBtn s2-confirmBtn--ghost" onClick={() => setRemoveConfirm(null)}>
                Cancel
              </button>
              <button type="button" className="s2-confirmBtn s2-confirmBtn--danger" onClick={handleConfirmRemove}>
                Yes, remove
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rateEditOpen ? (
        <div className="s2-rateEditOverlay" role="dialog" aria-modal="true" aria-label={rateEditOpen === 'hourly' ? 'Hourly rate' : 'Consultation fee'}>
          <button
            type="button"
            className="s2-addProdBackdrop"
            aria-label="Close"
            onClick={() => setRateEditOpen(null)}
          />
          <div className="s2-rateEditSheet">
            <header className="s2-rateEditHeader">
              <button type="button" className="s2-rateEditClose" aria-label="Close" onClick={() => setRateEditOpen(null)}>
                <X size={18} weight="regular" aria-hidden />
              </button>
              <h2 className="s2-rateEditTitle">{rateEditOpen === 'hourly' ? 'Hourly rate' : 'Consultation fee'}</h2>
              <p className="s2-rateEditHint">
                {rateEditOpen === 'hourly'
                  ? `$${ADJ_RATE_MIN}–$${ADJ_RATE_MAX} per hour · $1 steps`
                  : `$${ADJ_RATE_MIN}–$${ADJ_RATE_MAX} consultation fee · $1 steps`}
              </p>
            </header>
            {rateEditOpen === 'hourly' || rateEditOpen === 'consult' ? (
              <div className="s2-rateEditBody">
                {(() => {
                  const isHourly = rateEditOpen === 'hourly';
                  const rateVal = isHourly ? hourlyRate : consultRate;
                  const setRateVal = isHourly ? setHourlyRate : setConsultRate;
                  const fillPct =
                    ADJ_RATE_MAX > ADJ_RATE_MIN
                      ? ((rateVal - ADJ_RATE_MIN) / (ADJ_RATE_MAX - ADJ_RATE_MIN)) * 100
                      : 0;
                  return (
                    <>
                      <div className="s2-rateEditBig">
                        ${rateVal}
                        {isHourly ? <span className="s2-rateEditBig__suffix">/hr</span> : null}
                      </div>
                      <input
                        type="range"
                        className="s2-rateEditSlider"
                        min={ADJ_RATE_MIN}
                        max={ADJ_RATE_MAX}
                        step={1}
                        value={rateVal}
                        aria-valuemin={ADJ_RATE_MIN}
                        aria-valuemax={ADJ_RATE_MAX}
                        aria-valuenow={rateVal}
                        style={{ '--rate-fill': `${fillPct}%` }}
                        onChange={(e) => setRateVal(clampAdjustableRate(e.target.value))}
                      />
                      <label className="s2-rateEditField">
                        <span className="s2-rateEditField__label">{isHourly ? '$ / hour' : '$ consultation'}</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          className="s2-rateEditInput"
                          min={ADJ_RATE_MIN}
                          max={ADJ_RATE_MAX}
                          step={1}
                          value={rateVal}
                          onChange={(e) => setRateVal(clampAdjustableRate(e.target.value))}
                        />
                      </label>
                      <button type="button" className="s2-rateEditDone" onClick={() => setRateEditOpen(null)}>
                        Done
                      </button>
                    </>
                  );
                })()}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

    </div>
  );
}
