import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Butterfly,
  CalendarBlank,
  Camera,
  Clock,
  Image as ImageIcon,
  Lightning,
  Microphone,
  Minus,
  PencilSimple,
  Plus,
  Scissors,
  User,
  X,
  Gear,
} from 'phosphor-react';
import { MOCK_CLIENTS } from '../../data/mockClients';
import { MOCK_PRODUCTS } from '../../data/mockProducts';
import { MOCK_SERVICES } from '../../data/mockServices';
import {
  apptStateKey,
  buildAptNavPayload,
  getApptState,
  loadApptStateStore,
  readPersistedScreen2Apt,
  readPersistedScreen2From,
  readScreen2WorkflowForApt,
  saveApptStateStore,
  SVC_CONSULT_BASE,
  SVC_HOURLY_BASE,
  writePersistedScreen2Apt,
  writeScreen2WorkflowForApt,
} from '../../data/appointmentStateStore';
import { useTimers } from '../../context/TimersContext';
import AppointmentTimerBox from '../../component/AppointmentTimerBox';
import TimerModal from '../../component/TimerModal';
import './s2.css';
import './consultationBrief.css';

const S2_ICON_TOOLBAR = 24;
const S2_ICON_TOOLBAR_ACTIVE = 26;

/** Screen2 header progress: CHECK → CONSULT → SERVICE → LIFT → REBOOK */
const S2_WORKFLOW_STEPS = [
  ['check', 'CHECK'],
  ['consult', 'CONSULT'],
  ['services', 'SERVICE'],
  ['lift', 'LIFT'],
  ['booking', 'REBOOK'],
];

function emptyS2Workflow() {
  return { check: false, consult: false, services: false, lift: false, booking: false };
}

const TOOLBAR_ACTIVE = 1;
const TOOLBAR_ITEMS = [
  { Icon: Scissors, label: 'Stylist', to: '/screen1' },
  // Profile icon → Clients picker. Marked active on Screen2 since this screen
  // is the "client" half of the Profile flow.
  { Icon: User, label: 'Clients', to: '/clients' },
  { Icon: Lightning, label: 'Checkout', to: '/climax' },
  { Icon: CalendarBlank, label: 'Calendar', to: '/calendar' },
  { Icon: Gear, label: 'Settings', to: '/settings' },
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

/** Short primary label (accent in quad tiles) — matches reference “COLOR SERVICE” style */
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

/** Deck tile primary line — service name (reference: BALAYAGE, ORIBE) */
function svcDeckPrimaryTitle(s) {
  if (!s) return '';
  if (s.id === 'SVC-HOURLY' || s.kind === 'hourly') return 'HOURLY';
  if (s.id === 'SVC-CONSULT' || s.kind === 'consult') return 'CONSULT';
  return String(s.name).toUpperCase();
}

/** Deck tile secondary — category or rate type (reference: COLOR, grey) */
function svcDeckSecondaryLine(s) {
  if (!s) return '';
  if (s.id === 'SVC-HOURLY' || s.kind === 'hourly') return 'TIME-BASED';
  if (s.id === 'SVC-CONSULT' || s.kind === 'consult') return 'SESSION FEE';
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

function productImageUrl(p) {
  if (!p || typeof p.imageUrl !== 'string') return null;
  const u = p.imageUrl.trim();
  return u || null;
}

function serviceImageUrl(s) {
  if (!s || typeof s !== 'object') return null;
  const a = typeof s.image === 'string' ? s.image.trim() : '';
  const b = typeof s.imageUrl === 'string' ? s.imageUrl.trim() : '';
  return a || b || null;
}

/** Queue rows may omit `image` after older saves — resolve from picker catalog. */
function serviceImageUrlResolved(s, pickerList) {
  const direct = serviceImageUrl(s);
  if (direct) return direct;
  const id = s && s.id != null ? String(s.id) : '';
  if (!id || !Array.isArray(pickerList)) return null;
  const row = pickerList.find((x) => x && String(x.id) === id);
  return serviceImageUrl(row);
}

/** Product packshot over `MOCK_PRODUCTS` `imageUrl`; gradient stays as fallback / underlay. */
function S2ProductPhoto({ imageUrl, fallbackBackground, wrapClassName, imgClassName, decorative }) {
  return (
    <div
      className={wrapClassName}
      style={fallbackBackground ? { background: fallbackBackground } : undefined}
      aria-hidden={decorative ? true : undefined}
    >
      {imageUrl ? (
        <img
          className={imgClassName}
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.remove();
          }}
        />
      ) : null}
    </div>
  );
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

// React Router drops `location.state` on full page refresh — Screen2 falls back
// to `readPersistedScreen2Apt()` (sessionStorage) so LOOK photos / consult /
// per-appointment service+product queues all stay tied to the right appointment.

// Each pane (LIFE/CHAIR/PATH) stores a chronological log of notes — newest
// entry first. The legacy single-string field (e.g. `rec.LIFE`) is kept for
// backward compatibility and migrated into the entries array on first read.
function migratePaneEntries(rec, key) {
  const arr = rec[key + '_entries'];
  if (Array.isArray(arr) && arr.length) {
    const cleaned = arr
      .filter((e) => e && typeof e.text === 'string' && e.text.trim())
      .map((e) => ({ text: e.text, ts: typeof e.ts === 'number' ? e.ts : Date.now() }));
    if (cleaned.length) return cleaned;
  }
  const legacy = typeof rec[key] === 'string' ? rec[key].trim() : '';
  if (legacy) {
    return [{ text: legacy, ts: typeof rec.updatedAt === 'number' ? rec.updatedAt : Date.now() }];
  }
  return [];
}

/** Legacy single-string field stays aligned with newest stored note (index 0). */
function legacyFieldForPane(pane) {
  if (pane === 'LIFE' || pane === 'CHAIR' || pane === 'PATH') return pane;
  return null;
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
  const out = { id, name, price };
  const img = typeof raw.image === 'string' ? raw.image.trim() : '';
  if (img) out.image = img;
  if (raw.kind) out.kind = raw.kind;
  return out;
}

function enrichServiceCatalogImages(catalog) {
  const byId = Object.fromEntries(MOCK_SERVICES.map((s) => [s.id, s]));
  return catalog.map((row) => {
    const m = byId[row.id];
    if (m && typeof m.image === 'string' && m.image.trim() && !serviceImageUrl(row)) {
      return { ...row, image: m.image.trim() };
    }
    return row;
  });
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
    if (!normalized.length) return MOCK_SERVICES;
    return enrichServiceCatalogImages(normalized);
  } catch {
    return MOCK_SERVICES;
  }
}

// Per-appointment services/products live in `data/appointmentStateStore.js`.
// Imported above so Climax + Stylist share the exact same source of truth.

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

  // Where the user came from — used by the top-left Back button so it returns
  // to the right origin (Calendar vs Stylist). Persisted in session so a full
  // refresh on Screen2 still routes Back to the correct screen.
  const fromFromNav = (location?.state?.from && String(location.state.from)) || null;
  const backTarget = fromFromNav || readPersistedScreen2From() || '/screen1';

  useEffect(() => {
    if (activeAptFromNav) writePersistedScreen2Apt(activeAptFromNav, fromFromNav);
  }, [activeAptFromNav, fromFromNav]);

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

  /** Profile photo sheet (camera / library); avatar persists per client via consultation store. */
  const [avatarPhotoSheetOpen, setAvatarPhotoSheetOpen] = useState(false);

  const profilePhotoDisplayUrl =
    typeof consultRecord.avatar === 'string' && consultRecord.avatar.trim()
      ? consultRecord.avatar
      : null;

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
  // { pane, mode: 'new'|'edit', entryIndex?, entryTs?, synthetic? }
  const [noteEditOpen, setNoteEditOpen] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const noteDraftRef = useRef('');
  const noteEditOpenRef = useRef(null);
  // Step-through: some progress markers are decided by actions that happen
  // earlier in the file than the workflow state is declared (hook order).
  // We bridge via a ref so "Update note" can light CONSULT.
  const s2WorkflowMarkRef = useRef({ consult: () => {} });
  useEffect(() => {
    noteDraftRef.current = noteDraft;
  }, [noteDraft]);
  useEffect(() => {
    noteEditOpenRef.current = noteEditOpen;
  }, [noteEditOpen]);

  const [consultOpen, setConsultOpen] = useState(false);
  const [preBriefOpen, setPreBriefOpen] = useState(false);
  const lifeFeedRef = useRef(null);
  const chairFeedRef = useRef(null);
  const pathFeedRef = useRef(null);
  const lookGalleryRef = useRef(null);

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

  const openNewNote = useCallback((paneKey) => {
    stopVoice();
    setNoteDraft('');
    setNoteEditOpen({ pane: paneKey, mode: 'new' });
  }, [stopVoice]);

  /** Opens the composer and starts dictation on the next frame (mic header buttons). */
  const openNewNoteWithVoice = useCallback((paneKey) => {
    stopVoice();
    setNoteDraft('');
    setNoteEditOpen({ pane: paneKey, mode: 'new' });
    requestAnimationFrame(() => startVoice(paneKey));
  }, [startVoice, stopVoice]);

  // Save: new entry prepends; edit replaces the row (or seeds first stored row from defaults).
  // Refs avoid a stale `noteDraft` / `noteEditOpen` if the user taps Update on the same tick as typing (mobile).
  const submitNoteDraft = useCallback(() => {
    const meta = noteEditOpenRef.current;
    if (!meta) return;
    const text = (noteDraftRef.current || '').trim();
    if (!text) {
      stopVoice();
      setNoteEditOpen(null);
      return;
    }
    const { pane, mode, entryIndex, entryTs, synthetic } = meta;
    const key = pane + '_entries';
    const ts = Date.now();
    const leg = legacyFieldForPane(pane);

    if (mode === 'edit' && synthetic === true) {
      setConsultRecord((prev) => {
        const nextEntries = [{ text, ts }];
        const next = { ...prev, [key]: nextEntries };
        if (leg) next[leg] = text;
        return next;
      });
    } else if (
      mode === 'edit' &&
      Number.isInteger(entryIndex) &&
      entryIndex >= 0 &&
      synthetic !== true
    ) {
      setConsultRecord((prev) => {
        const existing = Array.isArray(prev[key]) ? [...prev[key]] : [];
        let ix = entryIndex;
        if (typeof entryTs === 'number' && !Number.isNaN(entryTs)) {
          const found = existing.findIndex((e) => e && e.ts === entryTs);
          if (found >= 0) ix = found;
        }
        if (ix < 0 || ix >= existing.length || !existing[ix]) return prev;
        existing[ix] = { ...existing[ix], text, ts };
        const next = { ...prev, [key]: existing };
        if (leg && existing[0]?.text != null) next[leg] = String(existing[0].text);
        return next;
      });
    } else {
      setConsultRecord((prev) => {
        const existing = Array.isArray(prev[key]) ? prev[key] : [];
        const nextEntries = [{ text, ts }, ...existing];
        const next = { ...prev, [key]: nextEntries };
        if (leg) next[leg] = text;
        return next;
      });
    }
    // A real interaction occurred (added/updated a note) — now light CONSULT.
    s2WorkflowMarkRef.current.consult?.();
    stopVoice();
    setNoteDraft('');
    setNoteEditOpen(null);
  }, [stopVoice]);

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
    const input = e.target;
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
      // iOS / mobile Safari: camera picker can leave focus on a hidden input and
      // swallow taps on the consult sheet until blur.
      requestAnimationFrame(() => {
        try {
          if (input) input.blur();
        } catch (_) {
          /* noop */
        }
      });
    };
    reader.readAsDataURL(file);
  }, []);

  // ---------- Profile photo (header) — modal + camera / library; session-only (no persist) ----------
  const avatarCameraInputRef = useRef(null);
  const avatarGalleryInputRef = useRef(null);

  const openAvatarPhotoSheet = useCallback(() => {
    setAvatarPhotoSheetOpen(true);
  }, []);

  const triggerAvatarCamera = useCallback(() => {
    setAvatarPhotoSheetOpen(false);
    requestAnimationFrame(() => {
      const input = avatarCameraInputRef.current;
      if (input) {
        input.value = '';
        input.click();
      }
    });
  }, []);

  const triggerAvatarGallery = useCallback(() => {
    setAvatarPhotoSheetOpen(false);
    requestAnimationFrame(() => {
      const input = avatarGalleryInputRef.current;
      if (input) {
        input.value = '';
        input.click();
      }
    });
  }, []);

  const handleAvatarFileChosen = useCallback((e) => {
    const file = e.target?.files?.[0];
    const input = e.target;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result;
      if (typeof url === 'string') {
        setConsultRecord((prev) => ({ ...prev, avatar: url }));
      }
      setAvatarPhotoSheetOpen(false);
      requestAnimationFrame(() => {
        try {
          if (input) input.blur();
        } catch (_) {
          /* noop */
        }
      });
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

  /** Snapshot when hourly/consult rate sheet opens — used to detect a real edit on dismiss. */
  const rateEditBaselineRef = useRef({ hourly: 0, consult: 0 });
  const rateEditOpenKindRef = useRef(null);

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

  // Step-through progress (dots + visited rims). CHECK completes when the user
  // lands on this screen with an appointment (e.g. tapped client card on S1).
  const [s2Workflow, setS2Workflow] = useState(emptyS2Workflow);
  useLayoutEffect(() => {
    if (!apptKey) {
      setS2Workflow(emptyS2Workflow());
      return;
    }
    const saved = readScreen2WorkflowForApt(apptKey);
    setS2Workflow({
      check: true,
      consult: !!saved?.consult,
      services: !!saved?.services,
      lift: !!saved?.lift,
      booking: !!saved?.booking,
    });
  }, [apptKey]);

  useEffect(() => {
    if (!apptKey) return undefined;
    const t = setTimeout(() => {
      writeScreen2WorkflowForApt(apptKey, s2Workflow);
    }, 120);
    return () => clearTimeout(t);
  }, [apptKey, s2Workflow]);

  const markS2ConsultVisited = useCallback(() => {
    setS2Workflow((w) => (w.consult ? w : { ...w, consult: true }));
  }, []);

  const markS2ServicesVisited = useCallback(() => {
    setS2Workflow((w) => (w.services ? w : { ...w, services: true }));
  }, []);
  const markS2LiftVisited = useCallback(() => {
    setS2Workflow((w) => (w.lift ? w : { ...w, lift: true }));
  }, []);
  const markS2BookingVisited = useCallback(() => {
    setS2Workflow((w) => (w.booking ? w : { ...w, booking: true }));
  }, []);
  s2WorkflowMarkRef.current.consult = markS2ConsultVisited;

  const dismissRateEdit = useCallback(() => {
    if (rateEditOpen === 'hourly' && hourlyRate !== rateEditBaselineRef.current.hourly) {
      markS2ServicesVisited();
    } else if (rateEditOpen === 'consult' && consultRate !== rateEditBaselineRef.current.consult) {
      markS2ServicesVisited();
    }
    setRateEditOpen(null);
  }, [rateEditOpen, hourlyRate, consultRate, markS2ServicesVisited]);

  const s2WorkflowNextIndex = useMemo(() => {
    const ix = S2_WORKFLOW_STEPS.findIndex(([key]) => !s2Workflow[key]);
    return ix < 0 ? -1 : ix;
  }, [s2Workflow]);

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
  const [removeConfirm, setRemoveConfirm] = useState(null);

  // ---------- Live timer for the active client ----------
  // Reads from the shared TimersContext (the same store ClientList /
  // Calendar use), keyed by client name. The chip shows when a timer or
  // stopwatch is running, or when one has just finished. Tapping it opens
  // the existing TimerModal so start/stop/reset works identically to S1.
  const { timers, setTimer, clearTimer } = useTimers();
  const timerKey = activeClientName;
  const persistedTimer = timers[timerKey] || null;

  const [tickNow, setTickNow] = useState(() => Date.now());
  useEffect(() => {
    const isLive =
      persistedTimer &&
      (persistedTimer.kind === 'timerRunning' ||
        persistedTimer.kind === 'stopwatchRunning');
    if (!isLive) return undefined;
    const id = setInterval(() => setTickNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [persistedTimer]);

  const liveTimer = useMemo(() => {
    if (!persistedTimer) return null;
    if (persistedTimer.kind === 'timerRunning') {
      const remainingMs = persistedTimer.endsAt - tickNow;
      if (remainingMs <= 0) return { kind: 'completed' };
      return { kind: 'timerRunning', remainingMs };
    }
    if (persistedTimer.kind === 'stopwatchRunning') {
      return { kind: 'stopwatchRunning', elapsedMs: tickNow - persistedTimer.startedAt };
    }
    return persistedTimer;
  }, [persistedTimer, tickNow]);

  // Promote expired countdowns to "completed" in the shared store so the
  // Calendar appointment chip + Stylist card flip into the done state too.
  useEffect(() => {
    if (
      liveTimer?.kind === 'completed' &&
      timers[timerKey]?.kind === 'timerRunning'
    ) {
      setTimer(timerKey, { kind: 'completed' });
    }
  }, [liveTimer, timers, timerKey, setTimer]);

  const [timerModalOpen, setTimerModalOpen] = useState(false);
  const handleTimerStart = useCallback(
    (totalSec) => {
      if (!timerKey) return;
      setTimer(timerKey, { kind: 'timerRunning', endsAt: Date.now() + totalSec * 1000 });
      setTickNow(Date.now());
      setTimerModalOpen(false);
    },
    [setTimer, timerKey],
  );
  const handleStopwatchStart = useCallback(() => {
    if (!timerKey) return;
    setTimer(timerKey, { kind: 'stopwatchRunning', startedAt: Date.now() });
    setTickNow(Date.now());
  }, [setTimer, timerKey]);
  const handleTimerStop = useCallback(() => {
    if (!timerKey) return;
    clearTimer(timerKey);
    setTimerModalOpen(false);
  }, [clearTimer, timerKey]);
  const handleTimerReset = useCallback(() => {
    if (!timerKey) return;
    clearTimer(timerKey);
  }, [clearTimer, timerKey]);

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

  useLayoutEffect(() => {
    if (!rateEditOpen) {
      rateEditOpenKindRef.current = null;
      return;
    }
    if (rateEditOpen !== rateEditOpenKindRef.current) {
      if (rateEditOpen === 'hourly') {
        rateEditBaselineRef.current.hourly = hourlyRate;
      } else if (rateEditOpen === 'consult') {
        rateEditBaselineRef.current.consult = consultRate;
      }
      rateEditOpenKindRef.current = rateEditOpen;
    }
  }, [rateEditOpen, hourlyRate, consultRate]);

  const openRemoveConfirm = useCallback((kind, id, label) => {
    setRemoveConfirm({ kind, id, label });
  }, []);

  const handleConfirmRemove = useCallback(() => {
    if (!removeConfirm) return;
    if (removeConfirm.kind === 'svc') {
      setSvcQueue((prev) => prev.filter((q) => q.id !== removeConfirm.id));
      markS2ServicesVisited();
    } else {
      setProductQueue((prev) => prev.filter((q) => q.id !== removeConfirm.id));
      markS2LiftVisited();
    }
    setRemoveConfirm(null);
  }, [removeConfirm, markS2ServicesVisited, markS2LiftVisited]);

  return (
    <div className="s2-root">
      <div className="s2-bg" />

      <div className="s2-topRightCurve" aria-hidden>
        <svg
          width="99"
          height="216"
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

      {/* TOP BAR */}
      <div className="s2-topbar">
        <button
          type="button"
          className="s2-back"
          onClick={() => navigate(backTarget)}
          aria-label="Back"
        >
          <ArrowLeft size={22} weight="regular" aria-hidden />
        </button>
      </div>

      {/* AVATAR + badges (left); name + phone optically centered on screen */}
      <div className="s2-identity">
        <div className="s2-identityMain">
          <div className="s2-identityLeft">
            <button
              type="button"
              className="s2-avatar"
              onClick={openAvatarPhotoSheet}
              aria-label={
                profilePhotoDisplayUrl ? 'Change profile photo' : 'Add profile photo'
              }
            >
              {profilePhotoDisplayUrl ? (
                <img
                  src={profilePhotoDisplayUrl}
                  alt={`${activeClient.name} photo`}
                  className="s2-avatar__img"
                  draggable={false}
                />
              ) : (
                <span className="s2-avatar__empty" aria-hidden>
                  <Camera size={32} weight="regular" />
                </span>
              )}
            </button>
            <input
              ref={avatarCameraInputRef}
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
              onChange={handleAvatarFileChosen}
            />
            <input
              ref={avatarGalleryInputRef}
              type="file"
              accept="image/*"
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
              onChange={handleAvatarFileChosen}
            />
            <div className="s2-msgBadges" aria-label="Unread messages">
              <div className="s2-msgBadge" aria-hidden>
                💬<span className="s2-msgBadge__count">{META.msgCount}</span>
          </div>
        </div>
          </div>
          <div className="s2-identityCenter">
            <div className="s2-identityText">
              <div className="s2-clientName">{activeClient.name}</div>
              <div className="s2-clientPhone">
                {activeClient.phone || (isNewClient ? 'New client' : '')}
              </div>
            </div>
          </div>
          <div className="s2-identityRight">
            <button type="button" className="s2-kebabText" aria-label="More">
              ⋮
          </button>
        </div>
      </div>

        <div className="s2-progress" aria-label="Progress">
          <div className="s2-progressDots" aria-hidden>
            {S2_WORKFLOW_STEPS.flatMap(([key], i) => {
              const lit = s2Workflow[key];
              const isCurrent = i === s2WorkflowNextIndex && s2WorkflowNextIndex >= 0;
              const dot = (
                <span
                  key={key}
                  className={`s2-pdot${lit ? ' is-lit' : ''}${!lit && isCurrent ? ' is-current' : ''}`}
                />
              );
              if (i === 0) return [dot];
              return [<span key={`s2-wf-line-${i}`} className="s2-dotLine" />, dot];
            })}
          </div>
          <div className="s2-pdotLabels">
            {S2_WORKFLOW_STEPS.map(([key, label], i) => {
              const lit = s2Workflow[key];
              const isCurrent = i === s2WorkflowNextIndex && s2WorkflowNextIndex >= 0;
              return (
                <div
                  key={key}
                  className={`s2-pdotLabel${lit ? ' is-lit' : ''}${!lit && isCurrent ? ' is-current' : ''}`}
                >
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT — v1.3 stack */}
      <div className="s2-body">
        <div className="s2-section">
          <div
            className={`s2-pill s2-pill--neutral s2-pill--consult${s2Workflow.consult ? ' s2-pill--workflowComplete' : ''}`}
          >
            Consultation
          </div>
          <button
            type="button"
            className={`s2-card s2-card--v13 s2-consultCard${s2Workflow.consult ? ' s2-workflowSurface--visited' : ''}`}
            onClick={() => setConsultOpen(true)}
            aria-label="Open consultation"
          >
            <div className="s2-royBand is-yellow" aria-hidden />
            <div className="s2-consultHeader">
              <div className="s2-consultHeader__cluster">
                <div className="s2-consultHeader__label">
                  {activeApptInfo ? 'Appointment' : 'Last visit'}
                </div>
                <div className="s2-consultHeader__value">
                  {activeApptInfo
                    ? `${activeApptInfo.dateShort}${
                        activeApptInfo.durationLabel ? ` \u2022 ${activeApptInfo.durationLabel}` : ''
                      }`
                    : `${CONSULT.lastVisitShort} \u2022 ${CONSULT.duration.replace(/\bmin\b/i, 'MIN')}`}
                </div>
              </div>
              <div className="s2-consultHeader__cluster s2-consultHeader__cluster--right">
                <div className="s2-consultHeader__label">
                  {activeApptInfo?.service?.trim()
                    ? activeApptInfo.service
                    : `${CONSULT.noteTag} \u2022 ${CONSULT.noteHint}`}
                </div>
                <div className="s2-consultHeader__value s2-consultHeader__value--sub">
                  {activeApptInfo
                    ? (activeApptInfo.durationLabel || '').replace(/\bmin\b/i, 'MIN') || 'Today'
                    : 'note'}
                </div>
              </div>
            </div>

            <div className="s2-consultScroll">
              {CONSULT.panes.map((p) => (
                <div key={p.key} className={`s2-pane ${p.colorClass}`}>
                  <div className={`s2-paneLabel ${p.colorClass}`}>{p.key}</div>
                  {p.key !== 'LOOK' ? (
                    <div className="s2-paneContent">
                      {(consultRecord[p.key] || '').trim() || p.text || ''}
                    </div>
                  ) : (
                    <div className="s2-paneContent s2-paneContent--lookRow">
                      <div className="s2-lookStrip">
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
                                <div key={t.label} className="s2-lookSlot">
                                  <div
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
                                  />
                                </div>
                              ))}
                              {extra > 0 ? <div className="s2-lookMore">+{extra}</div> : null}
                            </>
                          );
                        })()}
                      </div>
                      <div className="s2-lookRowActions">
                        <AppointmentTimerBox
                          lookRowRing
                          timerState={liveTimer}
                          onPress={() => setTimerModalOpen(true)}
                        />
                        <button
                          type="button"
                          className="s2-actionBtn is-mic"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConsultOpen(true);
                          }}
                          aria-label="Voice"
                        >
                          <span className="s2-actionBtn__ring" aria-hidden>
                            <Microphone size={12} weight="fill" />
                          </span>
                          <span className="s2-actionBtn__label">Voice</span>
                        </button>
            <button
              type="button"
                          className="s2-actionBtn is-cam"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConsultOpen(true);
                          }}
                          aria-label="Photo"
                        >
                          <span className="s2-actionBtn__ring" aria-hidden>
                            <Camera size={12} weight="fill" />
                          </span>
                          <span className="s2-actionBtn__label">Photo</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </button>
        </div>

        <div className="s2-section">
          <div className={`s2-pill s2-pill--neutral${s2Workflow.services ? ' s2-pill--workflowComplete' : ''}`}>Services</div>
          <div className={`s2-card s2-card--v13 s2-svcCard${s2Workflow.services ? ' s2-workflowSurface--visited' : ''}`}>
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
                const svcHeroImg = serviceImageUrlResolved(s, svcPickerList);
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
                    <div
                      className={`s2-svcDeckCard s2-svcDeckCard--quad${ix === 0 ? ' s2-svcDeckCard--selected' : ''}`}
                      title={s.name}
                    >
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
                      <div className="s2-svcDeckCard__hero" style={{ background: deckGrad }}>
                        {svcHeroImg ? (
                          <img
                            className="s2-svcDeckCard__heroPhoto"
                            src={svcHeroImg}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.remove();
                            }}
                          />
                        ) : null}
                      </div>
                      <span className="s2-svcDeckCard__accentBar" aria-hidden />
                      <div className="s2-svcDeckCard__body">
                        <div className="s2-svcDeckCard__headline">{svcDeckPrimaryTitle(s)}</div>
                        <div className="s2-svcDeckCard__subtitle">{svcDeckSecondaryLine(s)}</div>
                        <div
                          className={`s2-svcDeckCard__metaRow${isHourly ? ' s2-svcDeckCard__metaRow--priceOnly' : ''}`}
                        >
                          <span className="s2-svcDeckCard__price">{queuePriceLabel(s)}</span>
                          {isHourly ? null : isConsult ? (
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
                <span className="s2-refTile__plusCorner" aria-hidden>
                  <Plus size={13} weight="bold" />
                </span>
                <div className="s2-refTile__suggestedWrap">
                  <span className="s2-refTile__suggestedTitle">From catalog</span>
                  <span className="s2-refTile__suggestedSub">Tap to browse</span>
                  <div className="s2-refTile__suggestedFoot">
                    <span className="s2-refTile__suggestedPrice">—</span>
                    <span className="s2-refTile__suggestedDur">
                      <Clock size={9} weight="bold" aria-hidden />
                      Pick
                    </span>
                  </div>
                </div>
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
          <div className={`s2-pill s2-pill--neutral${s2Workflow.lift ? ' s2-pill--workflowComplete' : ''}`}>BACK BAR</div>
          <div className={`s2-card s2-card--v13 s2-hcCard${s2Workflow.lift ? ' s2-workflowSurface--visited' : ''}`}>
            <div className="s2-quadRow" aria-label="Back bar products">
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
                const prdImg = productImageUrl(p);
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
                    <div
                      className={`s2-svcDeckCard s2-svcDeckCard--quad s2-svcDeckCard--product${ix === 0 ? ' s2-svcDeckCard--selected' : ''}`}
                      title={p.name}
                    >
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
                      <div className="s2-svcDeckCard__hero" style={{ background: prdGrad }}>
                        {prdImg ? (
                          <img
                            className="s2-svcDeckCard__heroPhoto"
                            src={prdImg}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.remove();
                            }}
                          />
                        ) : null}
                      </div>
                      <span className="s2-svcDeckCard__accentBar" aria-hidden />
                      <div className="s2-svcDeckCard__body">
                        <div className="s2-svcDeckCard__headline">{p.brand}</div>
                        <div className="s2-svcDeckCard__subtitle">{p.name}</div>
                        <div className="s2-svcDeckCard__metaRow s2-svcDeckCard__metaRow--priceOnly">
                          <span className="s2-svcDeckCard__price">${p.price}</span>
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
                  onClick={() => setAddProductsOpen(true)}
                  aria-label="Suggested back bar"
                >
                  <span className="s2-refTile__badgeSuggested">SUGGESTED</span>
                  <div className="s2-refTile__silhouette" aria-hidden />
                  <span className="s2-refTile__plusCorner" aria-hidden>
                    <Plus size={13} weight="bold" />
                  </span>
                  <div className="s2-refTile__suggestedWrap">
                    <span className="s2-refTile__suggestedTitle">From catalog</span>
                    <span className="s2-refTile__suggestedSub">Tap to browse</span>
                    <div className="s2-refTile__suggestedFoot">
                      <span className="s2-refTile__suggestedPrice">—</span>
                      <span className="s2-refTile__suggestedDur">
                        <Clock size={9} weight="bold" aria-hidden />
                        Pick
                      </span>
                      </div>
                      </div>
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

        <div className="s2-bottomDock s2-bottomDock--inline">
          <div className="s2-bottomDock__content">
            <div className="s2-ctaRow">
              <button type="button" className="s2-cta is-rebook" onClick={markS2BookingVisited}>
                <div className="s2-ctaIcon" aria-hidden>↻</div>
                <div className="s2-ctaLabel">Rebook</div>
        </button>
              <button
                type="button"
                className="s2-cta is-checkout"
                onClick={() => {
                  markS2BookingVisited();
                  navigate('/climax', { state: { apt: activeApt, from: '/screen2' } });
                }}
              >
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
            onClick={() => {
                      if (to === '/clients') {
                        navigate(to, { state: { from: '/screen2' } });
                        return;
                      }
                      navigate(
                        to,
                        activeApt
                          ? {
                              state: {
                                apt: activeApt,
                                ...(to === '/climax' ? { from: '/screen2' } : {}),
                              },
                            }
                          : undefined,
                      );
            }}
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
      </div>

      {consultOpen ? (
        <div className="nc-popup" role="dialog" aria-modal="true" aria-label="Consultation brief">
          <div className="nc-pu-top">
            <button type="button" className="nc-close-x" aria-label="Close" onClick={closeConsultBrief}>
              ✕
            </button>
            <div className="nc-pu-id">
              <div
                className={`nc-pu-id-mini${profilePhotoDisplayUrl ? '' : ' nc-pu-id-mini--empty'}`}
              >
                {profilePhotoDisplayUrl ? (
                  <img src={profilePhotoDisplayUrl} alt="" draggable={false} />
                ) : (
                  <Camera size={14} weight="regular" aria-hidden />
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
                  <button type="button" className="nc-f-btn" aria-label="Add LIFE note" onClick={() => openNewNote('LIFE')}>
                    <PencilSimple size={14} weight="bold" aria-hidden />
                  </button>
                  <button type="button" className="nc-f-btn" aria-label="Voice LIFE note" onClick={() => openNewNoteWithVoice('LIFE')}>
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
                  lifeChron.map((entry, idx) => {
                    const entries = consultRecord.LIFE_entries;
                    const hasStored = Array.isArray(entries) && entries.length > 0;
                    const synthetic = !hasStored;
                    const storageIdx = hasStored ? entries.length - 1 - idx : -1;
                return (
                      <button
                        type="button"
                        key={`life-${entry.ts ?? 'n'}-${idx}`}
                        className={`nc-note${idx === lifeChron.length - 1 ? ' latest' : ''}`}
                        aria-label="Edit LIFE note"
                        onClick={(e) => {
                          e.stopPropagation();
                          stopVoice();
                          setNoteDraft(entry.text || '');
                          if (synthetic) {
                            setNoteEditOpen({ pane: 'LIFE', mode: 'edit', synthetic: true });
                          } else {
                            setNoteEditOpen({
                              pane: 'LIFE',
                              mode: 'edit',
                              entryIndex: storageIdx,
                              entryTs: typeof entry.ts === 'number' ? entry.ts : undefined,
                            });
                          }
                        }}
                      >
                        <div className="nc-ts">{entry.ts ? formatNoteDateShort(entry.ts) : '—'}</div>
                        <div className="nc-body">{entry.text}</div>
                      </button>
                    );
                  })
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
                  <button type="button" className="nc-f-btn" aria-label="Add CHAIR note" onClick={() => openNewNote('CHAIR')}>
                    <PencilSimple size={14} weight="bold" aria-hidden />
                  </button>
                  <button type="button" className="nc-f-btn" aria-label="Voice CHAIR note" onClick={() => openNewNoteWithVoice('CHAIR')}>
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
                  chairChron.map((entry, idx) => {
                    const entries = consultRecord.CHAIR_entries;
                    const hasStored = Array.isArray(entries) && entries.length > 0;
                    const synthetic = !hasStored;
                    const storageIdx = hasStored ? entries.length - 1 - idx : -1;
                    return (
                <button
                  type="button"
                        key={`chair-${entry.ts ?? 'n'}-${idx}`}
                        className={`nc-note${idx === chairChron.length - 1 ? ' latest' : ''}`}
                        aria-label="Edit CHAIR note"
                        onClick={(e) => {
                          e.stopPropagation();
                          stopVoice();
                          setNoteDraft(entry.text || '');
                          if (synthetic) {
                            setNoteEditOpen({ pane: 'CHAIR', mode: 'edit', synthetic: true });
                          } else {
                            setNoteEditOpen({
                              pane: 'CHAIR',
                              mode: 'edit',
                              entryIndex: storageIdx,
                              entryTs: typeof entry.ts === 'number' ? entry.ts : undefined,
                            });
                          }
                        }}
                      >
                        <div className="nc-ts">{entry.ts ? formatNoteDateShort(entry.ts) : '—'}</div>
                        <div className="nc-body">{entry.text}</div>
                  </button>
                );
                  })
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
                  <button type="button" className="nc-f-btn" aria-label="Add PATH note" onClick={() => openNewNote('PATH')}>
                    <PencilSimple size={14} weight="bold" aria-hidden />
        </button>
                  <button type="button" className="nc-f-btn" aria-label="Voice PATH note" onClick={() => openNewNoteWithVoice('PATH')}>
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
                  pathChron.map((entry, idx) => {
                    const entries = consultRecord.PATH_entries;
                    const hasStored = Array.isArray(entries) && entries.length > 0;
                    const synthetic = !hasStored;
                    const storageIdx = hasStored ? entries.length - 1 - idx : -1;
                    return (
                      <button
                        type="button"
                        key={`path-${entry.ts ?? 'n'}-${idx}`}
                        className={`nc-note${idx === pathChron.length - 1 ? ' latest' : ''}`}
                        aria-label="Edit PATH note"
                        onClick={(e) => {
                          e.stopPropagation();
                          stopVoice();
                          setNoteDraft(entry.text || '');
                          if (synthetic) {
                            setNoteEditOpen({ pane: 'PATH', mode: 'edit', synthetic: true });
                          } else {
                            setNoteEditOpen({
                              pane: 'PATH',
                              mode: 'edit',
                              entryIndex: storageIdx,
                              entryTs: typeof entry.ts === 'number' ? entry.ts : undefined,
                            });
                          }
                        }}
                      >
                        <div className="nc-ts">{entry.ts ? formatNoteDateShort(entry.ts) : '—'}</div>
                        <div className="nc-body">{entry.text}</div>
                      </button>
                    );
                  })
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

      {/* Note composer — absolute inside .s2-root (no visualViewport / keyboard avoiding). */}
      {noteEditOpen ? (
        <div
          className="s2-noteOverlay"
          role="dialog"
          aria-modal="true"
          aria-label={`${noteEditOpen.mode === 'edit' ? 'Update' : 'New'} ${noteEditOpen.pane} note`}
        >
          <button
            type="button"
            className="s2-noteBackdrop"
            aria-label="Cancel"
            onClick={cancelNoteDraft}
          />
          <div className="s2-noteSheet" role="document">
            <header className="s2-noteHeader">
              <div
                className={`s2-noteLabel ${
                  noteEditOpen.pane === 'LIFE'
                    ? 'is-pink'
                    : noteEditOpen.pane === 'CHAIR'
                      ? 'is-yellow'
                      : 'is-green'
                }`}
              >
                {noteEditOpen.pane}
              </div>
              <div className="s2-noteTitle">
                {noteEditOpen.mode === 'edit' ? 'Update note' : 'New note'}
              </div>
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
                placeholder={
                  noteEditOpen.mode === 'edit'
                    ? `Edit this ${noteEditOpen.pane.toLowerCase()} note…`
                    : `Tap mic to dictate, or type a new ${noteEditOpen.pane.toLowerCase()} note…`
                }
                autoFocus
                spellCheck={false}
              />
              <button
                type="button"
                className={`s2-noteMic${recordingPane === noteEditOpen.pane ? ' is-recording' : ''}`}
                aria-label={recordingPane === noteEditOpen.pane ? 'Stop dictation' : 'Start dictation'}
                aria-pressed={recordingPane === noteEditOpen.pane}
                onClick={() => toggleVoice(noteEditOpen.pane)}
              >
                <Microphone size={18} weight="fill" aria-hidden />
        </button>
            </div>

            <footer className="s2-noteFooter">
              <button
                type="button"
                className="s2-noteUpdate"
                disabled={!noteDraft.trim()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  submitNoteDraft();
                }}
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
                        markS2ServicesVisited();
                      }}
                    >
                      <S2ProductPhoto
                        imageUrl={serviceImageUrl(rowSvc)}
                        fallbackBackground={svcGradientForIndex(i)}
                        wrapClassName="s2-addProdCard__visual"
                        imgClassName="s2-addProdCard__photo"
                        decorative
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
                    <S2ProductPhoto
                      imageUrl={serviceImageUrlResolved(s, svcPickerList)}
                      fallbackBackground={svcGradientForPickerId(s.id, svcPickerList)}
                      wrapClassName="s2-svcPickQueueCard__thumb"
                      imgClassName="s2-svcPickQueueCard__photo"
                      decorative
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
                  onClick={() => {
                    setSvcQueue((prev) => [
                      ...prev,
                      { id: `SVC-C-${Date.now()}`, name: 'Custom service', price: 0 },
                    ]);
                    markS2ServicesVisited();
                  }}
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
                        markS2LiftVisited();
                      }}
                    >
                      <S2ProductPhoto
                        imageUrl={productImageUrl(p)}
                        fallbackBackground={productVisualGradient(p.color)}
                        wrapClassName="s2-addProdCard__visual"
                        imgClassName="s2-addProdCard__photo"
                        decorative
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
              <div className="s2-svcPickQueue__label">BACK BAR</div>
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
                    <S2ProductPhoto
                      imageUrl={productImageUrl(p)}
                      fallbackBackground={productVisualGradient(p.color)}
                      wrapClassName="s2-svcPickQueueCard__thumb"
                      imgClassName="s2-svcPickQueueCard__photo"
                      decorative
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

      {avatarPhotoSheetOpen ? (
        <div
          className="s2-avatarPhotoOverlay"
          role="dialog"
          aria-modal="true"
          aria-label="Profile photo"
        >
                  <button
            type="button"
            className="s2-addProdBackdrop"
            aria-label="Close"
            onClick={() => setAvatarPhotoSheetOpen(false)}
          />
          <div className="s2-avatarPhotoSheet">
            <h2 className="s2-avatarPhotoTitle">
              {profilePhotoDisplayUrl ? 'Change profile photo' : 'Add profile photo'}
            </h2>
            <div className="s2-avatarPhotoActions">
              <button
                type="button"
                className="s2-avatarPhotoBtn"
                onClick={triggerAvatarCamera}
              >
                <Camera size={22} weight="regular" aria-hidden />
                <span>Take a photo</span>
              </button>
              <button
                type="button"
                className="s2-avatarPhotoBtn"
                onClick={triggerAvatarGallery}
              >
                <ImageIcon size={22} weight="regular" aria-hidden />
                <span>
                  {profilePhotoDisplayUrl ? 'Choose a new photo' : 'Choose from library'}
                        </span>
              </button>
                    </div>
            <button
              type="button"
              className="s2-avatarPhotoCancel"
              onClick={() => setAvatarPhotoSheetOpen(false)}
            >
              Cancel
                  </button>
          </div>
        </div>
      ) : null}

      {rateEditOpen ? (
        <div className="s2-rateEditOverlay" role="dialog" aria-modal="true" aria-label={rateEditOpen === 'hourly' ? 'Hourly rate' : 'Consultation fee'}>
          <button
            type="button"
            className="s2-addProdBackdrop"
            aria-label="Close"
            onClick={dismissRateEdit}
          />
          <div className="s2-rateEditSheet">
            <header className="s2-rateEditHeader">
              <button type="button" className="s2-rateEditClose" aria-label="Close" onClick={dismissRateEdit}>
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
                      <button type="button" className="s2-rateEditDone" onClick={dismissRateEdit}>
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

      <TimerModal
        open={timerModalOpen}
        clientName={activeClientName}
        runningState={liveTimer}
        placement="center"
        onClose={() => setTimerModalOpen(false)}
        onStartTimer={handleTimerStart}
        onStartStopwatch={handleStopwatchStart}
        onStopStopwatch={handleTimerStop}
        onStopTimer={handleTimerStop}
        onResetTimer={handleTimerReset}
      />
    </div>
  );
}
