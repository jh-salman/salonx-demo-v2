import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowsOut,
  Camera,
  Clock,
  CaretRight,
  ChatCircle,
  Image as ImageIcon,
  Microphone,
  NotePencil,
  Plus,
  WaveTriangle,
  X,
} from 'phosphor-react';
import { MOCK_CLIENTS } from '../../data/mockClients';
import {
  appendProductCatalogEntry,
  appendServiceCatalogEntry,
  CALENDAR_UPDATED_EVENT,
  CALENDAR_V1_STORAGE_KEY,
  fetchDynamicProductCatalog,
  fetchDynamicServiceCatalog,
  loadServiceCatalogFromCalendarStorage,
  normalizeProductCatalogEntry,
  normalizeServiceCatalogEntry,
} from '../../data/s2Catalog';
import {
  mapServiceLibraryToCatalogEntry,
  S2_SERVICE_LIBRARY,
} from '../../data/s2ServiceLibrary';
import {
  deleteClientAvatar,
  getClientAvatar,
  putClientAvatar,
} from '../../data/clientAvatarDb';
import {
  CLIENTS_CATALOG_UPDATED,
  catalogAvatarForClient,
  findClientInCatalog,
  persistClientAvatarToCatalog,
  refreshClientsCatalogCache,
  uploadClientProfileImage,
} from '../../data/clientProfileAvatar';
import { isAppointmentsApiAvailable, createAppointmentRemote, deleteAppointmentRemote } from '../../data/v2AppointmentsApi';
import {
  notifyCalendarUpdated,
  removeAppointmentFromSessionCache,
  upsertAppointmentInSessionCache,
} from '../../data/calendarEventsStore';
import {
  apptStateFromVisitPayload,
  loadConsultStore,
  loadRemoteAppointmentVisit,
  loadRemoteConsultation,
  mergeRemoteConsultIntoStore,
  pauseRemoteConsultPersist,
  pauseRemoteVisitPersist,
  persistRemoteAppointmentVisit,
  persistRemoteConsultation,
  PRODUCTS_CATALOG_UPDATED,
  CONSULTATION_REMOTE_UPDATED,
  resumeRemoteConsultPersist,
  resumeRemoteVisitPersist,
  saveConsultStore,
  visitPayloadFromApptState,
} from '../../data/screen2RemoteStore';
import {
  apptStateKey,
  buildAptNavPayload,
  buildRebookParkItem,
  getApptState,
  loadApptStateStore,
  readPersistedScreen2Apt,
  readPersistedScreen2From,
  readScreen2WorkflowForApt,
  saveApptStateStore,
  SVC_CONSULT_BASE,
  SVC_HOURLY_BASE,
  writePersistedScreen2Apt,
  writePersistedCalendarBack,
  writeScreen2WorkflowForApt,
} from '../../data/appointmentStateStore';
import { useScreen1CalendarNav } from '../../hooks/useScreen1CalendarNav';
import { syncSalonxShellHeight } from '../../layout/viewportShellSync.js';
import { useTimers } from '../../context/TimersContext';
import { startCalendarRealtimeSync } from '../../sync/calendarRealtimeSync';
import TimerModal from '../../component/TimerModal';
import { fmtCountdown, fmtElapsed } from '../../component/AppointmentTimerBox';
import './s2.css';
import './consultationBrief.css';

const S2_ICON_NOTE = 14;

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

function formatS2HeaderTimer(state) {
  if (!state) return '0:00';
  if (state.kind === 'timerRunning') return fmtCountdown(state.remainingMs);
  if (state.kind === 'stopwatchRunning') return fmtElapsed(state.elapsedMs);
  if (state.kind === 'completed') return 'DONE';
  if (state.kind === 'completed') return 'DONE';
  return '0:00';
}

/** Top-right curve + date — visuals unchanged; transparent hit layer opens Calendar. */
function S2CalendarHitZone({ onOpen }) {
  const d = new Date();
  const dow = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const dayNum = d.getDate();

  return (
    <>
      <div className="s2-topRightCurve" aria-hidden>
        <svg
          width="99"
          height="216"
          viewBox="0 0 99 216"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className="s2-topRightCurve__path"
            d="M25.2381 94.5C-5.77198 68 1.82035 1 1.82035 1H47.3204H97.8204V235.5L90.8169 190C80.6496 135 56.2482 121 25.2381 94.5Z"
            strokeWidth="2"
            vectorEffect="nonScalingStroke"
          />
        </svg>
      </div>
      <div className="s2-rightStamp" aria-hidden>
        <div className="s2-rightStamp__dow">{dow}</div>
        <div className="s2-rightStamp__num">{dayNum}</div>
      </div>
      <button
        type="button"
        className="s2-calendarHit"
        onClick={onOpen}
        aria-label="Open calendar"
      />
    </>
  );
}

const CLIENT = {
  name: "Jon Klein",
  phone: "541-556-6923",
};

const META = {
  msgCount: 3,
};

const CONSULT = {
  lastVisitShort: 'May 17, 2026',
  duration: '60 min',
  noteTag: 'Single Process Color',
  noteHint: '60 min',
  panes: [
    {
      key: 'LIFE',
      colorClass: 'is-life',
      text: 'Expecting twins in July • Cabin rebuild\nJennifer → FSU • Loves coffee & travel',
    },
    {
      key: 'CHAIR',
      colorClass: 'is-chair',
      text: 'Root melt + balayage last visit\nKeeping it bright around the face\nWants softer grow-out • Low maintenance',
    },
    {
      key: 'PATH',
      colorClass: 'is-path',
      text: 'Shades EQ 7N + 7WB\n20g 7N / 10g 7WB • 10vol\nProcessed 20 min • Bond builder added',
    },
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

/** CREATE section category pills — gloss split out; treatment uses full label. */
function inferSvcCreatePillCategory(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.includes('gloss')) return 'GLOSS';
  const deck = inferSvcDeckCategory(name);
  if (deck === 'TREAT') return 'TREATMENT';
  return deck;
}

function isCatalogPickerService(s) {
  return s && s.id !== 'SVC-HOURLY' && s.id !== 'SVC-CONSULT';
}

function normalizeCreateServiceName(name) {
  return String(name || '').trim().toLowerCase();
}

/** Booked appointment service — orange in CREATE; everything else is a white add-on pill. */
function isScheduledCreateService(service, scheduledName) {
  const scheduled = normalizeCreateServiceName(scheduledName);
  if (!scheduled) return false;
  return normalizeCreateServiceName(service?.name) === scheduled;
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

function productVisualGradient(color) {
  return `linear-gradient(165deg, ${color} 0%, #0a0a0c 85%)`;
}

function productImageUrl(p) {
  if (!p || typeof p.imageUrl !== 'string') return null;
  const u = p.imageUrl.trim();
  return u || null;
}

/** Two-line product title for finish picker cells (dynamic catalog names). */
function productDisplayNameLines(name) {
  const text = (name || '').trim();
  if (!text) return [''];
  if (text.includes('\n')) return text.split('\n').slice(0, 2);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 2) return [text];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

function productPickOrder(queue, id) {
  const i = queue.findIndex((p) => p.id === id);
  return i >= 0 ? i + 1 : null;
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

/** Product packshot — catalog `imageUrl` with gradient fallback. */
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

// ---------- Consultation persistence (per-client, localStorage + API) ----------
const CONSULT_DEFAULT_TEXT = {
  LIFE: 'Sister-in-law expecting twins · cabin rebuild · Jennifer→FSU',
  CHAIR: 'Redken Shades EQ 7N · 7WB · use more 7N next time',
  PATH: 'Keep dimension · low maintenance · natural grow-out',
};

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
    avatarDataKey:
      typeof rec.avatarDataKey === 'string' && rec.avatarDataKey.trim()
        ? rec.avatarDataKey.trim()
        : null,
    ghost:
      rec.ghost && typeof rec.ghost === 'object' && !Array.isArray(rec.ghost)
        ? rec.ghost
        : null,
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

const S2_CONSULT_PREVIEW_NOTE_COUNT = 2;

/** S2 consult card — up to 2 newest stored entries per pane (storage is newest-first). */
function panePreviewLines(entries, fallbackText, max = S2_CONSULT_PREVIEW_NOTE_COUNT) {
  if (Array.isArray(entries) && entries.length) {
    return entries
      .filter((e) => e && String(e.text || '').trim())
      .slice(0, max)
      .map((e) => ({ text: String(e.text).trim(), ts: e.ts ?? null }));
  }
  if (fallbackText && String(fallbackText).trim()) {
    return [{ text: String(fallbackText).trim(), ts: null }];
  }
  return [];
}

/** Consultation popup rows — newest first (matches reference timeline). */
function paneRowsForPopup(entries, legacyText, defaultText) {
  if (Array.isArray(entries) && entries.length) {
    return entries.filter((e) => e && String(e.text || '').trim());
  }
  const fallback = (legacyText || '').trim() || defaultText;
  return fallback ? [{ ts: null, text: fallback, _synthetic: true }] : [];
}

const CONSULT_POPUP_SECTIONS = [
  { key: 'CHAIR', label: 'CHAIR', tone: 'chair', legacy: 'CHAIR', defaultText: CONSULT_DEFAULT_TEXT?.CHAIR },
  { key: 'PATH', label: 'FORMULAS', tone: 'path', legacy: 'PATH', defaultText: CONSULT_DEFAULT_TEXT?.PATH },
  { key: 'LIFE', label: 'LIFE', tone: 'life', legacy: 'LIFE', defaultText: CONSULT_DEFAULT_TEXT?.LIFE },
];

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
  const openCalendar = useScreen1CalendarNav();

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

  useEffect(() => {
    syncSalonxShellHeight();
    const onRotate = () => syncSalonxShellHeight();
    window.addEventListener('orientationchange', onRotate);
    window.visualViewport?.addEventListener('resize', onRotate);
    return () => {
      window.removeEventListener('orientationchange', onRotate);
      window.visualViewport?.removeEventListener('resize', onRotate);
    };
  }, []);

  const activeClientName = useMemo(() => {
    const fromNav = activeApt?.clientName;
    return (fromNav && String(fromNav).trim()) || CLIENT.name;
  }, [activeApt]);

  const [catalogClients, setCatalogClients] = useState([]);
  const [productCatalog, setProductCatalog] = useState([]);
  const serviceCatalogUpdatedAtRef = useRef(null);
  const productCatalogUpdatedAtRef = useRef(null);
  useEffect(() => {
    if (!isAppointmentsApiAvailable()) return;
    let cancelled = false;
    void refreshClientsCatalogCache().then((list) => {
      if (!cancelled && list) setCatalogClients(list);
    });
    const onCatalog = () => {
      void refreshClientsCatalogCache().then((list) => {
        if (list) setCatalogClients(list);
      });
    };
    window.addEventListener(CLIENTS_CATALOG_UPDATED, onCatalog);
    return () => {
      cancelled = true;
      window.removeEventListener(CLIENTS_CATALOG_UPDATED, onCatalog);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const syncProducts = () => {
      void fetchDynamicProductCatalog().then(({ list, updatedAt }) => {
        if (cancelled) return;
        setProductCatalog(list);
        if (updatedAt) productCatalogUpdatedAtRef.current = updatedAt;
      });
    };
    syncProducts();
    const onProducts = () => syncProducts();
    window.addEventListener(PRODUCTS_CATALOG_UPDATED, onProducts);
    return () => {
      cancelled = true;
      window.removeEventListener(PRODUCTS_CATALOG_UPDATED, onProducts);
    };
  }, []);

  useEffect(() => {
    if (!isAppointmentsApiAvailable()) return undefined;
    return startCalendarRealtimeSync({
      onProductCatalogUpdated: (payload) => {
        if (!payload?.stored || !Array.isArray(payload.products)) {
          void fetchDynamicProductCatalog().then(({ list, updatedAt }) => {
            setProductCatalog(list);
            if (updatedAt) productCatalogUpdatedAtRef.current = updatedAt;
          });
          return;
        }
        const list = payload.products
          .map((raw, i) => normalizeProductCatalogEntry(raw, `legacy-prod-${i}`))
          .filter(Boolean);
        setProductCatalog(list);
        if (typeof payload.updatedAt === 'string') {
          productCatalogUpdatedAtRef.current = payload.updatedAt;
        }
      },
      onPoll: () => {
        void fetchDynamicProductCatalog().then(({ list, updatedAt }) => {
          setProductCatalog(list);
          if (updatedAt) productCatalogUpdatedAtRef.current = updatedAt;
        });
      },
    });
  }, []);

  // DB catalog first, then mock — includes `avatar` URL from Postgres.
  const activeClient = useMemo(() => {
    const fromCatalog = findClientInCatalog({ name: activeClientName });
    if (fromCatalog) return fromCatalog;
    const target = activeClientName.toLowerCase();
    const match = MOCK_CLIENTS.find(
      (c) => (c.name || '').toLowerCase() === target,
    );
    return match || { name: activeClientName, phone: '', email: '' };
  }, [activeClientName, catalogClients]);

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

  // Consultation notes per client, persisted to localStorage
  const [consultRecord, setConsultRecord] = useState(() =>
    getConsultRecord(loadConsultStore(), activeClientName),
  );

  const isNewClient = useMemo(() => {
    const history =
      (consultRecord.LIFE_entries?.length || 0) +
      (consultRecord.CHAIR_entries?.length || 0) +
      (consultRecord.PATH_entries?.length || 0);
    return history === 0;
  }, [
    consultRecord.LIFE_entries,
    consultRecord.CHAIR_entries,
    consultRecord.PATH_entries,
  ]);

  const consultRecordRef = useRef(consultRecord);
  consultRecordRef.current = consultRecord;

  // Reload record if active client changes (local + remote when API available)
  useEffect(() => {
    const key = clientKey(activeClientName);
    setConsultRecord(getConsultRecord(loadConsultStore(), activeClientName));
    if (!isAppointmentsApiAvailable()) return undefined;
    let cancelled = false;
    void loadRemoteConsultation(activeClientName).then((data) => {
      if (cancelled || !data?.stored || !data.record) return;
      pauseRemoteConsultPersist();
      const { store, didMerge } = mergeRemoteConsultIntoStore(
        key,
        data.record,
        consultRecordRef.current,
      );
      if (didMerge) {
        setConsultRecord(getConsultRecord(store, activeClientName));
      }
      window.setTimeout(() => resumeRemoteConsultPersist(), 400);
    });
    return () => {
      cancelled = true;
    };
  }, [activeClientName]);

  // Poll + socket-less refresh while Ghost Notes brief is generating
  useEffect(() => {
    const ghost = consultRecord?.ghost;
    const key = clientKey(activeClientName);
    const needsPoll =
      isAppointmentsApiAvailable() &&
      ghost?.brief_status === 'generating' &&
      (!ghost?.appointmentId || ghost.appointmentId === activeApt?.id);

    const applyRemote = (data) => {
      if (!data?.stored || !data.record) return;
      pauseRemoteConsultPersist();
      const { store, didMerge } = mergeRemoteConsultIntoStore(
        key,
        data.record,
        consultRecordRef.current,
      );
      if (didMerge) {
        setConsultRecord(getConsultRecord(store, activeClientName));
      }
      window.setTimeout(() => resumeRemoteConsultPersist(), 400);
    };

    const onRemoteUpdated = () => {
      if (!isAppointmentsApiAvailable()) return;
      void loadRemoteConsultation(activeClientName).then(applyRemote);
    };

    window.addEventListener(CONSULTATION_REMOTE_UPDATED, onRemoteUpdated);

    if (!needsPoll) {
      return () => {
        window.removeEventListener(CONSULTATION_REMOTE_UPDATED, onRemoteUpdated);
      };
    }

    const pollId = window.setInterval(() => {
      void loadRemoteConsultation(activeClientName).then(applyRemote);
    }, 3000);

    return () => {
      window.clearInterval(pollId);
      window.removeEventListener(CONSULTATION_REMOTE_UPDATED, onRemoteUpdated);
    };
  }, [
    activeClientName,
    activeApt?.id,
    consultRecord?.ghost?.brief_status,
    consultRecord?.ghost?.appointmentId,
  ]);

  /** Profile photo sheet (camera / library); avatar persists per client via consultation store. */
  const [avatarPhotoSheetOpen, setAvatarPhotoSheetOpen] = useState(false);

  const [avatarIdbUrl, setAvatarIdbUrl] = useState(null);

  const profilePhotoDisplayUrl =
    (typeof consultRecord.avatar === 'string' && consultRecord.avatar.trim()
      ? consultRecord.avatar
      : null) ||
    catalogAvatarForClient(activeClient) ||
    (typeof avatarIdbUrl === 'string' && avatarIdbUrl.trim() ? avatarIdbUrl : null);

  useEffect(() => {
    const inline =
      typeof consultRecord.avatar === 'string' && consultRecord.avatar.trim();
    if (inline) {
      setAvatarIdbUrl(null);
      return undefined;
    }
    const key = clientKey(activeClientName);
    const store = loadConsultStore();
    const rawRow = store[key] || {};
    const idbKey =
      (typeof rawRow.avatarDataKey === 'string' && rawRow.avatarDataKey.trim()) || key;
    let cancelled = false;
    getClientAvatar(idbKey).then((url) => {
      if (cancelled) return;
      setAvatarIdbUrl(typeof url === 'string' && url ? url : null);
    });
    return () => {
      cancelled = true;
    };
  }, [activeClientName, consultRecord.avatar, consultRecord.avatarDataKey]);

  // Debounced persistence (large data: URLs go to IndexedDB; LS keeps a pointer only)
  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        const store = loadConsultStore();
        const key = clientKey(activeClientName);
        const storedRow = store[key] || {};
        const raw = { ...consultRecordRef.current, updatedAt: Date.now() };
        const storedGhost = storedRow.ghost;
        if (
          storedGhost &&
          typeof storedGhost === 'object' &&
          !Array.isArray(storedGhost)
        ) {
          const localGhost = raw.ghost;
          if (!localGhost) {
            raw.ghost = storedGhost;
          } else if (
            localGhost.brief_status === 'generating' &&
            storedGhost.brief_status === 'ready'
          ) {
            raw.ghost = storedGhost;
          }
        }
        const av = typeof raw.avatar === 'string' ? raw.avatar.trim() : '';
        const idbKeyExisting =
          typeof raw.avatarDataKey === 'string' && raw.avatarDataKey.trim()
            ? raw.avatarDataKey.trim()
            : null;

        if (av.startsWith('data:')) {
          try {
            await putClientAvatar(key, av);
            raw.avatar = '';
            raw.avatarDataKey = key;
          } catch (_) {
            /* keep inline if IDB fails */
          }
        } else if (av.startsWith('http://') || av.startsWith('https://')) {
          if (idbKeyExisting) {
            try {
              await deleteClientAvatar(idbKeyExisting);
            } catch (_) {
              /* noop */
            }
          }
          raw.avatarDataKey = null;
          try {
            await persistClientAvatarToCatalog({
              clientId: activeClient.id,
              name: activeClientName,
              avatarUrl: av,
            });
          } catch (_) {
            /* noop */
          }
        } else if (!av) {
          if (!idbKeyExisting) {
            try {
              await deleteClientAvatar(key);
            } catch (_) {
              /* noop */
            }
            raw.avatarDataKey = null;
          }
          raw.avatar = '';
          try {
            await persistClientAvatarToCatalog({
              clientId: activeClient.id,
              name: activeClientName,
              avatarUrl: '',
            });
          } catch (_) {
            /* noop */
          }
        }

        store[key] = raw;
        saveConsultStore(store);
        if (isAppointmentsApiAvailable()) {
          try {
            await persistRemoteConsultation(activeClientName, raw);
          } catch (_) {
            /* noop */
          }
        }
      })();
    }, 250);
    return () => clearTimeout(t);
  }, [consultRecord, activeClientName, activeClient.id]);

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

  const editPaneEntry = useCallback((paneKey, entry, idx, entries) => {
    stopVoice();
    setNoteDraft(entry.text || '');
    const hasStored = Array.isArray(entries) && entries.length > 0;
    const synthetic = !hasStored || entry._synthetic;
    if (synthetic) {
      setNoteEditOpen({ pane: paneKey, mode: 'edit', synthetic: true });
    } else {
      setNoteEditOpen({
        pane: paneKey,
        mode: 'edit',
        entryIndex: idx,
        entryTs: typeof entry.ts === 'number' ? entry.ts : undefined,
      });
    }
  }, [stopVoice]);

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

  const panePreviewChron = useMemo(
    () => ({
      LIFE: panePreviewLines(
        consultRecord.LIFE_entries,
        !consultRecord.LIFE_entries?.length
          ? (consultRecord.LIFE || '').trim() || CONSULT_DEFAULT_TEXT.LIFE
          : '',
      ),
      CHAIR: panePreviewLines(
        consultRecord.CHAIR_entries,
        !consultRecord.CHAIR_entries?.length
          ? (consultRecord.CHAIR || '').trim() || CONSULT_DEFAULT_TEXT.CHAIR
          : '',
      ),
      PATH: panePreviewLines(
        consultRecord.PATH_entries,
        !consultRecord.PATH_entries?.length
          ? (consultRecord.PATH || '').trim() || CONSULT_DEFAULT_TEXT.PATH
          : '',
      ),
    }),
    [consultRecord],
  );

  const photosChron = useMemo(() => {
    const p = [...(consultRecord.photos || [])].filter((x) => x && x.url);
    p.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    return p;
  }, [consultRecord.photos]);

  const preSummary = useMemo(() => {
    const ghost = consultRecord?.ghost;
    if (ghost?.brief_status === 'generating') {
      return 'Preparing consultation brief…';
    }
    const aiBrief =
      typeof ghost?.ai_brief === 'string' && ghost.ai_brief.trim()
        ? ghost.ai_brief.trim()
        : '';
    if (aiBrief) return aiBrief.length > 64 ? `${aiBrief.slice(0, 64)}…` : aiBrief;
    const plant =
      Array.isArray(ghost?.ai_plants) && ghost.ai_plants[0]?.text
        ? String(ghost.ai_plants[0].text).trim()
        : '';
    if (plant) return plant.length > 64 ? `${plant.slice(0, 64)}…` : plant;
    const n = (activeApt?.notes && String(activeApt.notes).trim()) || '';
    const svc = activeApt?.service ? String(activeApt.service).trim() : '';
    let s = '';
    if (n && svc) s = `${n} · ${svc}`;
    else s = n || svc || (isNewClient ? 'New appointment — screening & intake' : 'No pre-visit notes yet');
    return s.length > 64 ? `${s.slice(0, 64)}…` : s;
  }, [activeApt, consultRecord?.ghost, isNewClient]);

  const prePillKind = CONSULT.noteTag === 'YELLOW' ? 'alert' : isNewClient ? 'new' : 'returning';

  const returningSuffix = useMemo(() => {
    const mo = monthsSinceOldestEntry(consultRecord.LIFE_entries);
    if (isNewClient || !mo) return '';
    return ` · ${mo}MO`;
  }, [consultRecord.LIFE_entries, isNewClient]);

  const clientPhoneLine = useMemo(
    () => activeClient.phone || '—',
    [activeClient.phone],
  );

  const clientVisitLine = useMemo(
    () => visitOrdinalLabel(consultRecord.LIFE_entries?.length || 0, isNewClient),
    [consultRecord.LIFE_entries, isNewClient],
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
      [chairFeedRef, pathFeedRef, lifeFeedRef].forEach((r) => {
        const el = r.current;
        if (el) el.scrollTop = 0;
      });
      const g = lookGalleryRef.current;
      if (g) g.scrollLeft = Math.max(0, g.scrollWidth - g.clientWidth);
    });
  }, [consultOpen, consultRecord.LIFE_entries, consultRecord.CHAIR_entries, consultRecord.PATH_entries, consultRecord.photos, preBriefOpen]);

  // Stop recording when consult popup unmounts
  useEffect(() => {
    if (!recognitionRef.current) return;
    return () => stopVoice();
  }, [stopVoice]);

  // ---------- Photo capture (LOOK pane) ----------
  // Two hidden inputs: one with `capture` for the camera, one without for the
  // photo library. A small action sheet lets the user pick which source to use
  // so they can either take a fresh photo or upload one from their camera roll.
  const photoInputRef = useRef(null); // camera (capture="environment")
  const photoGalleryInputRef = useRef(null); // library (no capture)
  const photoSlotRef = useRef(null); // index of slot being filled, or null = next free
  const lookPhotoTapRef = useRef({ idx: null, lastTs: 0, pendingTimer: null });
  const [lookPhotoSheetOpen, setLookPhotoSheetOpen] = useState(false);
  const [lookSheetPhoto, setLookSheetPhoto] = useState(null);
  const [lookLargePhoto, setLookLargePhoto] = useState(null);

  const openPhotoPicker = useCallback((slotIndex, photo = null) => {
    photoSlotRef.current = typeof slotIndex === 'number' ? slotIndex : null;
    setLookSheetPhoto(photo?.url ? { url: photo.url, ts: photo.ts } : null);
    setLookPhotoSheetOpen(true);
  }, []);

  const LOOK_DOUBLE_TAP_MS = 320;

  const openLookLargePhoto = useCallback((ph) => {
    if (!ph?.url) return;
    setLookLargePhoto({
      url: ph.url,
      dateLabel: ph.ts
        ? formatNoteDateShort(ph.ts || consultRecord.updatedAt || Date.now())
        : null,
    });
  }, [consultRecord.updatedAt]);

  const handleLookPhotoTap = useCallback((ph, idx) => {
    const now = Date.now();
    const ref = lookPhotoTapRef.current;
    const isDouble = ref.idx === idx && now - ref.lastTs < LOOK_DOUBLE_TAP_MS;

    if (ref.pendingTimer) {
      clearTimeout(ref.pendingTimer);
      ref.pendingTimer = null;
    }

    if (isDouble) {
      ref.idx = null;
      ref.lastTs = 0;
      openLookLargePhoto(ph);
      return;
    }

    ref.idx = idx;
    ref.lastTs = now;
    ref.pendingTimer = setTimeout(() => {
      ref.pendingTimer = null;
      ref.idx = null;
      ref.lastTs = 0;
      const origIx = (consultRecord.photos || []).findIndex(
        (p) => p && p.url === ph.url && (p.ts || 0) === (ph.ts || 0),
      );
      openPhotoPicker(origIx >= 0 ? origIx : null, ph);
    }, LOOK_DOUBLE_TAP_MS);
  }, [openLookLargePhoto, openPhotoPicker, consultRecord.photos]);

  const closeLookPhotoSheet = useCallback(() => {
    setLookPhotoSheetOpen(false);
    setLookSheetPhoto(null);
  }, []);

  const triggerLookLargePicture = useCallback(() => {
    if (!lookSheetPhoto?.url) return;
    closeLookPhotoSheet();
    openLookLargePhoto(lookSheetPhoto);
  }, [closeLookPhotoSheet, lookSheetPhoto, openLookLargePhoto]);

  useEffect(() => {
    if (!consultOpen) {
      setLookLargePhoto(null);
      setLookSheetPhoto(null);
      const ref = lookPhotoTapRef.current;
      if (ref.pendingTimer) clearTimeout(ref.pendingTimer);
      lookPhotoTapRef.current = { idx: null, lastTs: 0, pendingTimer: null };
    }
  }, [consultOpen]);

  const triggerLookCamera = useCallback(() => {
    closeLookPhotoSheet();
    requestAnimationFrame(() => {
      const input = photoInputRef.current;
      if (input) {
        input.value = '';
        input.click();
      }
    });
  }, [closeLookPhotoSheet]);

  const triggerLookGallery = useCallback(() => {
    closeLookPhotoSheet();
    requestAnimationFrame(() => {
      const input = photoGalleryInputRef.current;
      if (input) {
        input.value = '';
        input.click();
      }
    });
  }, [closeLookPhotoSheet]);

  const handlePhotoChosen = useCallback((e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const input = e.target;
    const slot = photoSlotRef.current;

    const applyPhotoUrl = (url) => {
      setConsultRecord((prev) => {
        const photos = Array.isArray(prev.photos) ? [...prev.photos] : [];
        const item = { url, ts: Date.now() };
        if (typeof slot === 'number' && slot >= 0 && slot < photos.length) {
          photos[slot] = { ...photos[slot], ...item };
        } else {
          photos.push(item);
        }
        return { ...prev, photos, updatedAt: Date.now() };
      });
      requestAnimationFrame(() => {
        try {
          if (input) input.blur();
        } catch (_) {
          /* noop */
        }
      });
    };

    if (isAppointmentsApiAvailable()) {
      void (async () => {
        try {
          const remoteUrl = await uploadClientProfileImage(file);
          applyPhotoUrl(remoteUrl);
          return;
        } catch (err) {
          console.warn('[Screen2] LOOK photo upload failed', err);
        }
        const reader = new FileReader();
        reader.onload = () => applyPhotoUrl(reader.result);
        reader.readAsDataURL(file);
      })();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => applyPhotoUrl(reader.result);
    reader.readAsDataURL(file);
  }, []);

  // ---------- Profile photo (header) — modal + camera / library; session-only (no persist) ----------
  const avatarCameraInputRef = useRef(null);
  const avatarGalleryInputRef = useRef(null);
  const avatarTapRef = useRef({ lastTs: 0, pendingTimer: null });

  const openAvatarPhotoSheet = useCallback(() => {
    setAvatarPhotoSheetOpen(true);
  }, []);

  const closeAvatarPhotoSheet = useCallback(() => {
    setAvatarPhotoSheetOpen(false);
  }, []);

  const handleAvatarTap = useCallback(() => {
    if (!profilePhotoDisplayUrl) {
      openAvatarPhotoSheet();
      return;
    }

    const now = Date.now();
    const ref = avatarTapRef.current;
    const isDouble = now - ref.lastTs < LOOK_DOUBLE_TAP_MS;

    if (ref.pendingTimer) {
      clearTimeout(ref.pendingTimer);
      ref.pendingTimer = null;
    }

    if (isDouble) {
      ref.lastTs = 0;
      openLookLargePhoto({ url: profilePhotoDisplayUrl });
      return;
    }

    ref.lastTs = now;
    ref.pendingTimer = setTimeout(() => {
      ref.pendingTimer = null;
      ref.lastTs = 0;
      openAvatarPhotoSheet();
    }, LOOK_DOUBLE_TAP_MS);
  }, [profilePhotoDisplayUrl, openAvatarPhotoSheet, openLookLargePhoto]);

  const triggerAvatarLargePicture = useCallback(() => {
    if (!profilePhotoDisplayUrl) return;
    closeAvatarPhotoSheet();
    openLookLargePhoto({ url: profilePhotoDisplayUrl });
  }, [closeAvatarPhotoSheet, profilePhotoDisplayUrl, openLookLargePhoto]);

  useEffect(() => {
    return () => {
      const ref = avatarTapRef.current;
      if (ref.pendingTimer) clearTimeout(ref.pendingTimer);
    };
  }, []);

  const triggerAvatarCamera = useCallback(() => {
    closeAvatarPhotoSheet();
    requestAnimationFrame(() => {
      const input = avatarCameraInputRef.current;
      if (input) {
        input.value = '';
        input.click();
      }
    });
  }, [closeAvatarPhotoSheet]);

  const triggerAvatarGallery = useCallback(() => {
    closeAvatarPhotoSheet();
    requestAnimationFrame(() => {
      const input = avatarGalleryInputRef.current;
      if (input) {
        input.value = '';
        input.click();
      }
    });
  }, [closeAvatarPhotoSheet]);

  const handleAvatarFileChosen = useCallback(
    (e) => {
      const file = e.target?.files?.[0];
      const input = e.target;
      if (!file) return;

      const finish = () => {
        closeAvatarPhotoSheet();
        requestAnimationFrame(() => {
          try {
            if (input) input.blur();
          } catch (_) {
            /* noop */
          }
        });
      };

      if (isAppointmentsApiAvailable()) {
        void (async () => {
          try {
            const remoteUrl = await uploadClientProfileImage(file);
            setConsultRecord((prev) => ({ ...prev, avatar: remoteUrl }));
            await persistClientAvatarToCatalog({
              clientId: activeClient.id,
              name: activeClientName,
              avatarUrl: remoteUrl,
            });
            finish();
            return;
          } catch (err) {
            console.warn('[Screen2] profile photo upload failed', err);
          }
          const reader = new FileReader();
          reader.onload = () => {
            const url = reader.result;
            if (typeof url === 'string') {
              setConsultRecord((prev) => ({ ...prev, avatar: url }));
            }
            finish();
          };
          reader.readAsDataURL(file);
        })();
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result;
        if (typeof url === 'string') {
          setConsultRecord((prev) => ({ ...prev, avatar: url }));
        }
        finish();
      };
      reader.readAsDataURL(file);
    },
    [activeClient.id, activeClientName],
  );

  const [addServicesOpen, setAddServicesOpen] = useState(false);
  const [servicePickerCategory, setServicePickerCategory] = useState(null);
  const [addProductsOpen, setAddProductsOpen] = useState(false);
  const [productPickDraft, setProductPickDraft] = useState([]);
  const [productPickFlashId, setProductPickFlashId] = useState(null);
  const productPickFlashTimerRef = useRef(null);
  const [rateEditOpen, setRateEditOpen] = useState(null);

  const [serviceCatalogList, setServiceCatalogList] = useState(loadServiceCatalogFromCalendarStorage);
  useEffect(() => {
    let cancelled = false;
    const syncServices = () => {
      void fetchDynamicServiceCatalog().then(({ list, updatedAt }) => {
        if (cancelled) return;
        setServiceCatalogList(list);
        if (updatedAt) serviceCatalogUpdatedAtRef.current = updatedAt;
      });
    };
    syncServices();
    const onCalendar = () => {
      if (isAppointmentsApiAvailable()) return;
      setServiceCatalogList(loadServiceCatalogFromCalendarStorage());
    };
    window.addEventListener(CALENDAR_UPDATED_EVENT, onCalendar);
    const onStorage = (e) => {
      if (e.key === CALENDAR_V1_STORAGE_KEY || e.key === null) onCalendar();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener(CALENDAR_UPDATED_EVENT, onCalendar);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!addServicesOpen) return;
    void fetchDynamicServiceCatalog().then(({ list, updatedAt }) => {
      setServiceCatalogList(list);
      if (updatedAt) serviceCatalogUpdatedAtRef.current = updatedAt;
    });
  }, [addServicesOpen]);

  useEffect(() => {
    if (addServicesOpen) return;
    setServicePickerCategory(null);
  }, [addServicesOpen]);

  useEffect(() => {
    if (!addProductsOpen) return;
    setProductPickDraft([...productQueue]);
    setProductPickFlashId(null);
    void fetchDynamicProductCatalog().then(({ list, updatedAt }) => {
      setProductCatalog(list);
      if (updatedAt) productCatalogUpdatedAtRef.current = updatedAt;
    });
  }, [addProductsOpen]);

  useEffect(
    () => () => {
      if (productPickFlashTimerRef.current) {
        clearTimeout(productPickFlashTimerRef.current);
      }
    },
    [],
  );

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
    if (!isAppointmentsApiAvailable() || !apptKey) return undefined;
    let cancelled = false;
    void loadRemoteAppointmentVisit(apptKey).then((data) => {
      if (cancelled || !data?.stored || !data.visit) return;
      const remote = apptStateFromVisitPayload(data.visit);
      if (!remote) return;
      pauseRemoteVisitPersist();
      const store = loadApptStateStore();
      store[apptKey] = {
        svcQueue: remote.svcQueue,
        productQueue: remote.productQueue,
        hourlyRate: remote.hourlyRate,
        consultRate: remote.consultRate,
        updatedAt: remote.updatedAt,
      };
      saveApptStateStore(store);
      setHourlyRate(remote.hourlyRate);
      setConsultRate(remote.consultRate);
      setSvcQueue(remote.svcQueue);
      setProductQueue(remote.productQueue);
      window.setTimeout(() => resumeRemoteVisitPersist(), 400);
    });
    return () => {
      cancelled = true;
    };
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
  // Step-through: CONSULT completes when the consultation brief (S2S) opens.
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

  const bookingStepNotify = s2WorkflowNextIndex === 4 && !s2Workflow.booking;

  const rebookTarget = useMemo(() => {
    if (!activeApt?.start || !activeApt?.end) return null;
    const start = new Date(activeApt.start);
    const end = new Date(activeApt.end);
    start.setDate(start.getDate() + 28);
    end.setDate(end.getDate() + 28);
    return { start, end };
  }, [activeApt]);

  const rebookTargetLabel = useMemo(() => {
    if (!rebookTarget) return '';
    return rebookTarget.start.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [rebookTarget]);

  const [rebookModalOpen, setRebookModalOpen] = useState(false);
  const [rebookBusy, setRebookBusy] = useState(false);

  const handleOpenRebookModal = useCallback(() => {
    markS2BookingVisited();
    setRebookModalOpen(true);
  }, [markS2BookingVisited]);

  const handleRebookMoveToPark = useCallback(() => {
    if (!rebookTarget) return;
    markS2BookingVisited();
    const rebookToPark = buildRebookParkItem(
      activeApt,
      rebookTarget,
      activeClientName,
    );
    const sourceId = activeApt?.id;
    if (sourceId) {
      removeAppointmentFromSessionCache(String(sourceId));
      notifyCalendarUpdated();
      if (isAppointmentsApiAvailable()) {
        void deleteAppointmentRemote(sourceId).catch((err) => {
          console.warn('[Screen2] rebook park: source delete failed', err);
        });
      }
    }
    writePersistedCalendarBack('/screen2', { rebookToPark });
    setRebookModalOpen(false);
    navigate('/calendar', {
      state: { from: '/screen2', rebookToPark },
    });
  }, [navigate, rebookTarget, activeApt, activeClientName, markS2BookingVisited]);

  const handleRebookOk = useCallback(async () => {
    if (!rebookTarget) return;
    markS2BookingVisited();
    if (!isAppointmentsApiAvailable()) {
      setRebookModalOpen(false);
      handleRebookMoveToPark();
      return;
    }
    setRebookBusy(true);
    try {
      const { appointment } = await createAppointmentRemote({
        clientName: activeApt?.clientName || activeClientName,
        service: activeApt?.service || '',
        start: rebookTarget.start.toISOString(),
        end: rebookTarget.end.toISOString(),
        color: activeApt?.color || '#3b82f6',
        price: typeof activeApt?.price === 'number' ? activeApt.price : 0,
        notes: activeApt?.notes || '',
      });
      upsertAppointmentInSessionCache(appointment);
      setRebookModalOpen(false);
    } catch (err) {
      console.warn('[Screen2] rebook create failed', err);
      window.alert(`Could not rebook (${err instanceof Error ? err.message : 'error'}).`);
    } finally {
      setRebookBusy(false);
    }
  }, [rebookTarget, activeApt, activeClientName, markS2BookingVisited, handleRebookMoveToPark]);

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
      if (isAppointmentsApiAvailable()) {
        void persistRemoteAppointmentVisit(
          apptKey,
          visitPayloadFromApptState({
            svcQueue,
            productQueue,
            hourlyRate,
            consultRate,
          }),
        ).catch(() => {
          /* noop */
        });
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [apptKey, svcQueue, productQueue, hourlyRate, consultRate]);

  const [removeConfirm, setRemoveConfirm] = useState(null);

  // ---------- Live timer for the active appointment (or client fallback) ----------
  // Shared TimersContext with Calendar chips + ClientList. Key is per-appointment
  // when Screen2 was opened with an apt from Calendar (`apptKey`); otherwise client name.
  const { timers, setTimer, clearTimer } = useTimers();
  const timerKey = apptKey || activeClientName;
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
  const timerCompleted = liveTimer?.kind === 'completed';


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

  const handleAddCustomService = useCallback(() => {
    const entry = normalizeServiceCatalogEntry({
      id: `SVC-C-${Date.now()}`,
      name: 'Custom service',
      price: 0,
    });
    if (!entry) return;
    setSvcQueue((prev) => [...prev, entry]);
    markS2ServicesVisited();
    void appendServiceCatalogEntry(entry, serviceCatalogUpdatedAtRef.current).then(({ list, updatedAt }) => {
      setServiceCatalogList(list);
      if (updatedAt) serviceCatalogUpdatedAtRef.current = updatedAt;
    });
  }, [markS2ServicesVisited]);

  const handleAddCustomProduct = useCallback(() => {
    const entry = normalizeProductCatalogEntry({
      id: `PROD-C-${Date.now()}`,
      brand: 'Custom',
      name: 'Custom product',
      price: 0,
      color: '#1a1612',
    });
    if (!entry) return;
    if (addProductsOpen) {
      setProductPickDraft((prev) => [...prev, entry]);
      setProductQueue((prev) => [...prev, entry]);
      markS2LiftVisited();
    } else {
      setProductQueue((prev) => [...prev, entry]);
      markS2LiftVisited();
    }
    void appendProductCatalogEntry(entry, productCatalogUpdatedAtRef.current).then(({ list, updatedAt }) => {
      setProductCatalog(list);
      if (updatedAt) productCatalogUpdatedAtRef.current = updatedAt;
    });
  }, [addProductsOpen, markS2LiftVisited]);

  const touchProductPick = useCallback(
    (product) => {
      setProductPickFlashId(product.id);
      if (productPickFlashTimerRef.current) clearTimeout(productPickFlashTimerRef.current);
      productPickFlashTimerRef.current = window.setTimeout(() => setProductPickFlashId(null), 400);
      const toggleQueue = (prev) =>
        prev.some((q) => q.id === product.id)
          ? prev.filter((q) => q.id !== product.id)
          : [...prev, product];
      setProductPickDraft(toggleQueue);
      setProductQueue(toggleQueue);
      markS2LiftVisited();
    },
    [markS2LiftVisited],
  );

  const confirmProductPick = useCallback(() => {
    markS2LiftVisited();
    setAddProductsOpen(false);
  }, [markS2LiftVisited]);

  const displaySvcQueue = useMemo(() => sortSvcQueueForDisplay(svcQueue), [svcQueue]);

  const createSectionServices = useMemo(
    () => displaySvcQueue.filter((s) => s.id !== 'SVC-HOURLY' && s.id !== 'SVC-CONSULT'),
    [displaySvcQueue],
  );

  const scheduledCreateServiceName = useMemo(
    () => activeApptInfo?.service?.trim() || activeApt?.service?.trim() || '',
    [activeApptInfo?.service, activeApt?.service],
  );

  const openServicePicker = useCallback((category = null) => {
    setServicePickerCategory(category);
    setAddServicesOpen(true);
  }, []);

  /** Bright 5×5 service grid — package tiles (reference ADD SERVICE). */
  const brightSvcGridList = useMemo(() => {
    const base = S2_SERVICE_LIBRARY.map(mapServiceLibraryToCatalogEntry).filter(Boolean);
    if (!servicePickerCategory) return base;
    const filtered = base.filter(
      (s) => inferSvcCreatePillCategory(s.name) === servicePickerCategory,
    );
    return filtered.length > 0 ? filtered : base;
  }, [servicePickerCategory]);

  const finishRowProducts = useMemo(() => (productQueue || []).slice(0, 4), [productQueue]);
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
    <div className="s2-frame">
      {!consultOpen ? (
        <button
          type="button"
          className="s2-backTab s2-backTab--s2ScreenMid"
          onClick={() => navigate(backTarget)}
          aria-label="Back"
        >
          <ArrowLeft size={18} weight="bold" aria-hidden />
        </button>
      ) : null}
    <div className="s2-root">
      <div className="s2-bg" />

      <S2CalendarHitZone onOpen={openCalendar} />

      {/* Header — row1: avatar · name · timer · stepper below */}
      <div className="s2-identity">
        <div className="s2-identityMain">
          <div className="s2-identityLeft">
            <button
              type="button"
              className="s2-avatar"
              onClick={handleAvatarTap}
              aria-label={
                profilePhotoDisplayUrl
                  ? 'Profile photo. Tap for options, double tap for large picture.'
                  : 'Add profile photo'
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
                  <Camera size={64} weight="regular" />
                </span>
              )}
            </button>
          </div>
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
          <div className="s2-identityCenter">
            <div className="s2-identityText">
              <div className="s2-clientName">{activeClient.name}</div>
              <div className="s2-clientPhone">{clientPhoneLine}</div>
              <div className="s2-clientVisit">{clientVisitLine}</div>
            </div>
          </div>
          <div className="s2-identityRight">
            <button
              className={`s2-headerTimer${timerCompleted ? ' s2-headerTimer--completed' : ''}`}
              onClick={() => setTimerModalOpen(true)}
              aria-label={timerCompleted ? 'Timer completed' : 'Open timer'}
            >
              <span className="s2-headerTimer__row">
                <Clock size={16} weight="bold" aria-hidden />
                <span className="s2-headerTimer__value">{formatS2HeaderTimer(liveTimer)}</span>
              </span>
              <span className="s2-headerTimer__label">TIMER</span>
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
              const prevKey = S2_WORKFLOW_STEPS[i - 1][0];
              const lineLit = !!s2Workflow[prevKey];
              return [
                <span key={`s2-wf-line-${i}`} className={`s2-dotLine${lineLit ? ' is-lit' : ''}`} />,
                dot,
              ];
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
        <div className="s2-content">
        <div className="s2-sectionsStack">
        <div className="s2-section s2-section--consult">
            <div
            className={`s2-card s2-card--v13 s2-consultCard${s2Workflow.consult ? ' s2-workflowSurface--visited' : ''}`}
          >
            <button
              type="button"
              className="s2-consultCardHit"
              aria-label="Open consultation"
              onClick={() => {
                markS2ConsultVisited();
                setConsultOpen(true);
              }}
            >
            <div
              className={`s2-consultTitle${s2Workflow.consult ? ' s2-consultTitle--complete' : ''}`}
              aria-hidden
            >
              <span className="s2-consultTitle__rule" />
              <span className="s2-consultTitle__text">Consultation</span>
              <span className="s2-consultTitle__rule" />
            </div>
            <div className="s2-consultHeader">
              <div className="s2-consultHeader__value s2-consultHeader__value--left">
                  {activeApptInfo
                    ? `${activeApptInfo.dateShort}${
                        activeApptInfo.durationLabel ? ` \u2022 ${activeApptInfo.durationLabel}` : ''
                      }`
                    : `${CONSULT.lastVisitShort} \u2022 ${CONSULT.duration.replace(/\bmin\b/i, 'min')}`}
              </div>
              <div
                className={`s2-consultHeader__value s2-consultHeader__value--right${
                  activeApptInfo?.service?.trim() ? ' s2-consultHeader__value--service' : ''
                }`}
              >
                  {activeApptInfo?.service?.trim()
                    ? `${activeApptInfo.service}${
                        activeApptInfo.durationLabel ? ` \u2022 ${activeApptInfo.durationLabel}` : ''
                      }`
                    : `${CONSULT.noteTag} \u2022 ${CONSULT.noteHint}`}
              </div>
        </div>

            <div className="s2-consultScroll">
              {CONSULT.panes.filter((p) => p.key !== 'LOOK').map((p) => {
                const chron = panePreviewChron[p.key] || [];
                return (
                <div key={p.key} className={`s2-pane ${p.colorClass}`}>
                  <span className="s2-paneDot" aria-hidden />
                  <div className="s2-paneBody">
                    {chron.length ? (
                      chron.map((entry, idx) => (
                        <div key={`${p.key}-${entry.ts ?? idx}`} className="s2-paneLine">
                          {entry.text}
                        </div>
                      ))
                    ) : (
                      <div className="s2-paneLine">{p.text || ''}</div>
                    )}
                  </div>
                  <span className="s2-paneArrow" aria-hidden>
                    →
                  </span>
                </div>
                );
              })}
            </div>
            </button>
          </div>
        </div>

        <div className="s2-section s2-section--create">
          <div
            className={`s2-card s2-card--v13 s2-createCard${s2Workflow.services ? ' s2-workflowSurface--visited' : ''}`}
          >
            <div
              className={`s2-createTitle${s2Workflow.services ? ' s2-createTitle--complete' : ''}`}
              aria-hidden
            >
              <span className="s2-createTitle__rule" />
              <span className="s2-createTitle__text">Create</span>
              <span className="s2-createTitle__rule" />
            </div>
            <div className="s2-createBody">
              <div className="s2-createRow" aria-label="Services">
                {createSectionServices.map((s, i) => {
                  const isScheduled = isScheduledCreateService(s, scheduledCreateServiceName);
                  return (
                  <button
                    key={`${s.id}-${i}`}
                    type="button"
                    className={`s2-createCatPill s2-createCatPill--queued${
                      isScheduled ? ' s2-createCatPill--scheduled' : ' s2-createCatPill--addon'
                    }`}
                    onClick={() => {
                      setSvcQueue((prev) => prev.filter((q) => q.id !== s.id));
                    }}
                    aria-label={`Remove ${s.name}`}
                  >
                    <span className="s2-createCatPill__label s2-createCatPill__label--service">
                      {s.name}
                    </span>
                  </button>
                  );
                })}
                <button
                  type="button"
                  className="s2-createCatPill s2-createCatPill--add"
                  onClick={() => openServicePicker(null)}
                  aria-label="Add service"
                >
                  <Plus size={14} weight="bold" aria-hidden className="s2-createCatPill__addIcon" />
                  <span className="s2-createCatPill__label s2-createCatPill__label--stack">
                    ADD
                    <br />
                    SERVICE
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="s2-section s2-section--finish">
          <div
            className={`s2-card s2-card--v13 s2-finishCard${s2Workflow.lift ? ' s2-workflowSurface--visited' : ''}`}
          >
            <div
              className={`s2-finishTitle${s2Workflow.lift ? ' s2-finishTitle--complete' : ''}`}
              aria-hidden
            >
              <span className="s2-finishTitle__rule" />
              <span className="s2-finishTitle__text">Finish</span>
              <span className="s2-finishTitle__rule" />
            </div>
            <div className="s2-finishBody">
              <div className="s2-finishRow" aria-label="Back bar products">
                {finishRowProducts.map((p, i) => (
                  <React.Fragment key={p.id}>
                    {i > 0 ? <span className="s2-finishRow__divider" aria-hidden /> : null}
                    <button
                      type="button"
                      className="s2-finishProduct"
                      onClick={() => setAddProductsOpen(true)}
                      aria-label={`${p.brand} ${p.name}`}
                    >
                      <div className="s2-finishProduct__photo">
                        <S2ProductPhoto
                          imageUrl={productImageUrl(p)}
                          fallbackBackground={productVisualGradient(p.color || '#1a1612')}
                          wrapClassName="s2-finishProduct__photoWrap"
                          imgClassName="s2-finishProduct__photoImg"
                          decorative
                        />
                      </div>
                      <div className="s2-finishProduct__brand">{p.brand}</div>
                      <div className="s2-finishProduct__name">{p.shortName || p.name}</div>
                    </button>
                  </React.Fragment>
                ))}
                {finishRowProducts.length > 0 ? (
                  <span className="s2-finishRow__divider" aria-hidden />
                ) : null}
                <button
                  type="button"
                  className="s2-finishProduct s2-finishProduct--add"
                  onClick={() => setAddProductsOpen(true)}
                  aria-label="Add product"
                >
                  <div className="s2-finishProduct__photo">
                    <div className="s2-finishProduct__photoWrap s2-finishProduct__photoWrap--add">
                      <Plus size={16} weight="bold" aria-hidden className="s2-finishProduct__addIcon" />
                    </div>
                  </div>
                  <div className="s2-finishProduct__brand">ADD</div>
                  <div className="s2-finishProduct__name">PRODUCT</div>
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
        </div>
      </div>

      <div className="s2-section s2-section--action s2-actionDock">
        <div className="s2-card s2-card--v13 s2-actionCard">
          <div className="s2-actionBody">
            <div className="s2-actionRow" aria-label="Actions">
              <button
                type="button"
                className={`s2-cta is-rebook${bookingStepNotify ? ' is-notify' : ''}`}
                onClick={handleOpenRebookModal}
              >
                <div className="s2-ctaIcon" aria-hidden>↻</div>
                <div className="s2-ctaLabel">REBOOK</div>
              </button>
              <button
                type="button"
                className={`s2-cta is-checkout${bookingStepNotify ? ' is-notify' : ''}`}
                onClick={() => {
                  navigate('/climax', {
                    state: {
                      from: '/screen2',
                      apt: activeApt,
                      clientPhone: activeClient.phone || '',
                    },
                  });
                }}
              >
                <div className="s2-ctaIcon" aria-hidden><span className="s2-flagIcon" /></div>
                <div className="s2-ctaLabel">CLIMAX</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {consultOpen ? (
        <div className="nc-popup" role="dialog" aria-modal="true" aria-label="Consultation brief">
          <div className="nc-popup__header">
            <S2CalendarHitZone onOpen={openCalendar} />
            <div className="s2-identity s2-identity--popup">
              <div className="s2-identityMain">
                <div className="s2-identityLeft">
                  <button
                    type="button"
                    className="s2-avatar"
                    onClick={handleAvatarTap}
                    aria-label={
                      profilePhotoDisplayUrl
                        ? 'Profile photo. Tap for options, double tap for large picture.'
                        : 'Add profile photo'
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
                        <Camera size={64} weight="regular" />
                      </span>
                    )}
                  </button>
                </div>
                <div className="s2-identityCenter">
                  <div className="s2-identityText">
                    <div className="s2-clientName">{activeClient.name}</div>
                    <div className="s2-clientPhone">{clientPhoneLine}</div>
                    <div className="s2-clientVisit">{clientVisitLine}</div>
                  </div>
                </div>
                <div className="s2-identityRight">
                  <button
                    className={`s2-headerTimer${timerCompleted ? ' s2-headerTimer--completed' : ''}`}
                    onClick={() => setTimerModalOpen(true)}
                    aria-label={timerCompleted ? 'Timer completed' : 'Open timer'}
                  >
                    <span className="s2-headerTimer__row">
                      <Clock size={16} weight="bold" aria-hidden />
                      <span className="s2-headerTimer__value">
                        {formatS2HeaderTimer(liveTimer)}
                      </span>
                    </span>
                    <span className="s2-headerTimer__label">TIMER</span>
                  </button>
                </div>
              </div>
            </div>
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
                {META.msgCount ? (
                  <span className="nc-pc-chat" aria-label={`${META.msgCount} messages`}>
                    <ChatCircle size={14} weight="regular" aria-hidden />
                    <span>{META.msgCount}</span>
                  </span>
                ) : null}
                <CaretRight size={14} weight="bold" className="nc-pc-chev" aria-hidden />
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

          <div className="ncv2-scroll">
            <button
              type="button"
              className="nc-popup__backRail s2-sectionBackTab"
              onClick={closeConsultBrief}
              aria-label="Back"
            >
              <ArrowLeft size={18} weight="bold" aria-hidden />
            </button>
            {CONSULT_POPUP_SECTIONS.map((sec) => {
              const entries = consultRecord?.[`${sec.key}_entries`] || [];
              const rows = paneRowsForPopup(
                entries,
                consultRecord?.[sec.legacy],
                sec.defaultText,
              );
              const feedRef =
                sec.key === 'CHAIR'
                  ? chairFeedRef
                  : sec.key === 'PATH'
                    ? pathFeedRef
                    : lifeFeedRef;

              return (
                <section key={sec.key} className={`ncv2-section is-${sec.tone}`}>
                  <div className="ncv2-section__head">
                    <span className="ncv2-section__dot" aria-hidden />
                    <span className="ncv2-section__label">{sec.label}</span>
                    <button
                      type="button"
                      className="ncv2-section__mic"
                      onClick={() => openNewNoteWithVoice(sec.key)}
                      aria-label={`Voice ${sec.label} note`}
                    >
                      <Microphone size={14} weight="regular" aria-hidden />
                    </button>
                  </div>

                  <div className="ncv2-section__rows" ref={feedRef}>
                    {rows.length === 0 ? (
                      <button
                        type="button"
                        className="ncv2-row ncv2-row--empty"
                        onClick={() => openNewNote(sec.key)}
                      >
                        <span className="ncv2-row__date">—</span>
                        <span className="ncv2-row__body">Tap to add</span>
                      </button>
                    ) : (
                      rows.map((entry, idx) => (
                        <button
                          key={`${sec.key}-${entry.ts ?? idx}-${idx}`}
                          type="button"
                          className="ncv2-row"
                          onClick={() => editPaneEntry(sec.key, entry, idx, entries)}
                        >
                          <span className="ncv2-row__date">
                            {entry.ts ? formatNoteDateShort(entry.ts) : '—'}
                          </span>
                          <span className="ncv2-row__body">{entry.text}</span>
                        </button>
                      ))
                    )}
                  </div>
                </section>
              );
            })}

            <section className="ncv2-section is-look">
              <div className="ncv2-section__head">
                <span className="ncv2-section__dot" aria-hidden />
                <span className="ncv2-section__label">LOOK</span>
                <button
                  type="button"
                  className="ncv2-look__cam"
                  onClick={() => openPhotoPicker(null)}
                  aria-label="Add LOOK photo"
                >
                  <Camera size={16} weight="regular" aria-hidden />
                </button>
              </div>

              <div className="ncv2-look__meta">
                <span className="ncv2-look__count">{photosChron.length} PHOTOS</span>
                <span className="ncv2-look__sep" aria-hidden>••</span>
                <span className="ncv2-look__hint">SCROLL</span>
              </div>

              <div className="ncv2-look__body">
                <div className="ncv2-look__gallery" ref={lookGalleryRef}>
                  {photosChron.map((ph, idx) => (
                    <div className="ncv2-look__col" key={`${ph.ts ?? idx}-${idx}`}>
                      <button
                        type="button"
                        className="ncv2-look__card"
                        onClick={() => handleLookPhotoTap(ph, idx)}
                        aria-label={`LOOK photo ${idx + 1}. Tap for options, double tap for large picture.`}
                      >
                        <div
                          className="ncv2-look__img"
                          style={{ backgroundImage: ph.url ? `url(${ph.url})` : undefined }}
                        />
                      </button>
                      <div className="ncv2-look__date">
                        {formatNoteDateShort(ph.ts || consultRecord.updatedAt || Date.now())}
                      </div>
                    </div>
                  ))}
                  <div className="ncv2-look__col ncv2-look__col--add">
                    <button
                      type="button"
                      className="ncv2-look__card ncv2-look__add"
                      onClick={() => openPhotoPicker(null)}
                      aria-label="Add LOOK photo"
                    >
                      <Plus size={44} weight="regular" aria-hidden />
                    </button>
                    <div className="ncv2-look__date ncv2-look__date--spacer" aria-hidden="true">
                      &nbsp;
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="ncv2-actions">
            <button
              type="button"
              className="ncv2-action ncv2-action--voice"
              onClick={() => openNewNoteWithVoice('LIFE')}
            >
              <WaveTriangle size={18} weight="bold" aria-hidden />
              <span>VOICE NOTE</span>
            </button>
            <button
              type="button"
              className="ncv2-action ncv2-action--add"
              onClick={() => openNewNote('LIFE')}
            >
              <NotePencil size={16} weight="regular" aria-hidden />
              <span>ADD NOTE</span>
            </button>
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
          <input
            ref={photoGalleryInputRef}
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
            onChange={handlePhotoChosen}
          />
      </div>
      ) : null}

      {lookPhotoSheetOpen ? (
        <div
          className="s2-avatarPhotoOverlay"
          role="dialog"
          aria-modal="true"
          aria-label="Add LOOK photo"
        >
          <button
            type="button"
            className="s2-addProdBackdrop"
            aria-label="Close"
            onClick={closeLookPhotoSheet}
          />
          <div className="s2-avatarPhotoSheet">
            <h2 className="s2-avatarPhotoTitle">Add a photo</h2>
            <div className="s2-avatarPhotoActions">
              <button
                type="button"
                className="s2-avatarPhotoBtn"
                onClick={triggerLookCamera}
              >
                <Camera size={22} weight="regular" aria-hidden />
                <span>Take a photo</span>
              </button>
              <button
                type="button"
                className="s2-avatarPhotoBtn"
                onClick={triggerLookGallery}
              >
                <ImageIcon size={22} weight="regular" aria-hidden />
                <span>Choose from camera roll</span>
              </button>
              {lookSheetPhoto?.url ? (
                <button
                  type="button"
                  className="s2-avatarPhotoBtn"
                  onClick={triggerLookLargePicture}
                >
                  <ArrowsOut size={22} weight="regular" aria-hidden />
                  <span>Large picture</span>
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className="s2-avatarPhotoCancel"
              onClick={closeLookPhotoSheet}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {lookLargePhoto ? (
        <div
          className="s2-lookLargeOverlay"
          role="dialog"
          aria-modal="true"
          aria-label="Client photo large view"
        >
          <button
            type="button"
            className="s2-addProdBackdrop"
            aria-label="Close"
            onClick={() => setLookLargePhoto(null)}
          />
          <button
            type="button"
            className="s2-lookLargeFrame"
            onClick={() => setLookLargePhoto(null)}
            aria-label="Close large picture"
          >
            <span className="s2-lookLargeClose" aria-hidden="true">
              <X size={16} weight="bold" />
            </span>
            <img
              src={lookLargePhoto.url}
              alt=""
              className="s2-lookLargeImg"
              draggable={false}
            />
          </button>
        </div>
      ) : null}

      {/* Note composer — absolute inside .s2-root; data-salonx-keyboard-lock ties into main.jsx visualViewport lock. */}
      {noteEditOpen ? (
        <div
          className="s2-noteOverlay"
          data-salonx-keyboard-lock=""
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
        <div
          className="s2-addProdOverlay s2-addProdOverlay--serviceGrid"
          role="dialog"
          aria-modal="true"
          aria-label="Add services"
        >
          <button
            type="button"
            className="s2-addProdBackdrop"
            aria-label="Close"
            onClick={() => setAddServicesOpen(false)}
          />
          <div className="s2-addProdSheet s2-addProdSheet--serviceGrid">
            <header className="s2-svcPickHeader">
              <div className="s2-svcPickHeader__row">
                <div className="s2-svcPickHeader__titles">
                  <button
                    type="button"
                    className="s2-svcPickHeader__kicker"
                    onClick={() => setAddServicesOpen(false)}
                  >
                    ← S2 - CREATE
                  </button>
                  <h2 className="s2-svcPickHeader__title">ADD SERVICE</h2>
                </div>
                <p
                  className={`s2-svcPickHeader__hint${
                    createSectionServices.length > 0 ? ' is-active' : ''
                  }`}
                >
                  {createSectionServices.length > 0
                    ? `${createSectionServices.length} ADDED`
                    : 'INDEX TO ADD'}
                </p>
              </div>
            </header>

            <div className="s2-svcPickScroll">
              <div className="s2-svcPickGrid">
                {brightSvcGridList.map((s) => {
                  const inQueue = svcQueue.some((q) => q.id === s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`s2-svcPickTile${inQueue ? ' is-inQueue' : ''}`}
                      aria-pressed={inQueue}
                      aria-label={`Add ${s.name}`}
                      onClick={() => {
                        setSvcQueue((prev) =>
                          prev.some((q) => q.id === s.id)
                            ? prev.filter((q) => q.id !== s.id)
                            : [...prev, s],
                        );
                        markS2ServicesVisited();
                      }}
                    >
                      <img
                        src={s.image}
                        alt=""
                        className="s2-svcPickTile__img"
                        draggable={false}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="s2-svcPickConfirm is-visible">
              <button
                type="button"
                className="s2-svcPickConfirm__btn"
                onClick={() => {
                  markS2ServicesVisited();
                  setAddServicesOpen(false);
                }}
              >
                <span className="s2-svcPickConfirm__label">ADD TO S2</span>
                <span className="s2-svcPickConfirm__count">
                  {createSectionServices.length}{' '}
                  {createSectionServices.length === 1 ? 'SERVICE' : 'SERVICES'} →
                </span>
              </button>
            </div>

            <button
              type="button"
              className="s2-svcPickCustomLink"
              onClick={handleAddCustomService}
            >
              ADD CUSTOM SERVICE
            </button>
          </div>
        </div>
      ) : null}

      {addProductsOpen ? (
        <div
          className="s2-addProdOverlay s2-addProdOverlay--finishGrid"
          role="dialog"
          aria-modal="true"
          aria-label="Add products to finish"
        >
          <button
            type="button"
            className="s2-addProdBackdrop"
            aria-label="Close"
            onClick={() => setAddProductsOpen(false)}
          />
          <div className="s2-addProdSheet s2-addProdSheet--finishGrid">
            <header className="s2-finishPickHeader">
              <div className="s2-finishPickHeader__row">
                <div className="s2-finishPickHeader__titles">
                  <button
                    type="button"
                    className="s2-finishPickHeader__kicker"
                    onClick={() => setAddProductsOpen(false)}
                  >
                    ← S2 - FINISH
                  </button>
                  <h2 className="s2-finishPickHeader__title">ADD PRODUCT</h2>
                </div>
                <p
                  className={`s2-finishPickHeader__hint${
                    productPickDraft.length > 0 ? ' is-active' : ''
                  }`}
                >
                  {productPickDraft.length > 0
                    ? `${productPickDraft.length} ADDED`
                    : 'INDEX TO ADD'}
                </p>
              </div>
            </header>

            <div className="s2-finishPickScroll">
              <div className="s2-finishPickGrid">
                {productCatalog.length === 0 ? (
                  <p className="s2-finishPickEmpty">No products in catalog yet.</p>
                ) : null}
                {productCatalog.map((p) => {
                  const selected = productPickDraft.some((q) => q.id === p.id);
                  const order = productPickOrder(productPickDraft, p.id);
                  const displayName = (p.shortName || p.name || '').replace(/\n/g, ' ').trim();
                  const flashing = productPickFlashId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`s2-finishPickCard${selected ? ' is-selected' : ''}${
                        flashing ? ' is-flash' : ''
                      }`}
                      aria-pressed={selected}
                      onClick={() => touchProductPick(p)}
                    >
                      {order ? (
                        <span className="s2-finishPickCard__badge" aria-hidden>
                          {order}
                        </span>
                      ) : null}
                      <div className="s2-finishPickCard__visual">
                        <S2ProductPhoto
                          imageUrl={productImageUrl(p)}
                          fallbackBackground="#fff"
                          wrapClassName="s2-finishPickCard__photoWrap"
                          imgClassName="s2-finishPickCard__photo"
                          decorative
                        />
                      </div>
                      <div className="s2-finishPickCard__meta">
                        <div className="s2-finishPickCard__brand">{p.brand}</div>
                        <div className="s2-finishPickCard__name">{displayName}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="s2-finishPickConfirm is-visible">
              <button type="button" className="s2-finishPickConfirm__btn" onClick={confirmProductPick}>
                <span className="s2-finishPickConfirm__label">ADD TO S2</span>
                <span className="s2-finishPickConfirm__count">
                  {productPickDraft.length}{' '}
                  {productPickDraft.length === 1 ? 'PRODUCT' : 'PRODUCTS'} →
                </span>
              </button>
            </div>

            <button
              type="button"
              className="s2-finishPickCustomLink"
              onClick={handleAddCustomProduct}
            >
              ADD CUSTOM PRODUCT
            </button>
          </div>
        </div>
      ) : null}

      {rebookModalOpen ? (
        <div className="s2-confirmOverlay" role="dialog" aria-modal="true" aria-labelledby="s2-rebook-confirm-title">
          <button
            type="button"
            className="s2-addProdBackdrop"
            aria-label="Cancel"
            onClick={() => setRebookModalOpen(false)}
          />
          <div className="s2-confirmSheet">
            <h2 id="s2-rebook-confirm-title" className="s2-confirmTitle">
              Rebook in 4 weeks?
            </h2>
            <p className="s2-confirmBody">
              {activeClientName}
              {rebookTargetLabel ? ` · ${rebookTargetLabel}` : ''}
              {activeApptInfo?.service?.trim() ? ` · ${activeApptInfo.service}` : ''}
            </p>
            <div className="s2-confirmActions">
              <button
                type="button"
                className="s2-confirmBtn s2-confirmBtn--ghost"
                onClick={handleRebookMoveToPark}
                disabled={rebookBusy || !rebookTarget}
              >
                MOVE TO PARK
              </button>
              <button
                type="button"
                className="s2-confirmBtn s2-confirmBtn--primary"
                onClick={() => void handleRebookOk()}
                disabled={rebookBusy || !rebookTarget}
              >
                {rebookBusy ? 'Booking…' : 'OK'}
              </button>
            </div>
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
            onClick={closeAvatarPhotoSheet}
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
              {profilePhotoDisplayUrl ? (
                <button
                  type="button"
                  className="s2-avatarPhotoBtn"
                  onClick={triggerAvatarLargePicture}
                >
                  <ArrowsOut size={22} weight="regular" aria-hidden />
                  <span>Large picture</span>
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className="s2-avatarPhotoCancel"
              onClick={closeAvatarPhotoSheet}
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
        onResetTimer={handleTimerReset}
        onStopTimer={handleTimerStop}
      />
    </div>
    </div>
  );
}
