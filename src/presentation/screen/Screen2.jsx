import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Butterfly,
  CalendarBlank,
  Camera,
  Lightning,
  Microphone,
  Minus,
  PencilSimple,
  Scissors,
  User,
  X,
} from 'phosphor-react';
import { MOCK_CLIENTS } from '../../data/mockClients';
import { MOCK_PRODUCTS } from '../../data/mockProducts';
import { MOCK_SERVICES } from '../../data/mockServices';
import './s2.css';

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

  // Resolve appointment + client from nav state (Calendar single-tap passes `apt`)
  const activeApt = location?.state?.apt || null;

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

  const [consultOpen, setConsultOpen] = useState(false);
  const [addServicesOpen, setAddServicesOpen] = useState(false);
  const [addProductsOpen, setAddProductsOpen] = useState(false);
  const [rateEditOpen, setRateEditOpen] = useState(null);

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

  const displaySvcRestQueue = useMemo(
    () => displaySvcQueue.filter((s) => s.id !== 'SVC-HOURLY' && s.id !== 'SVC-CONSULT'),
    [displaySvcQueue],
  );

  const hourlySvc = useMemo(
    () => ({ ...SVC_HOURLY_BASE, price: hourlyRate, kind: 'hourly' }),
    [hourlyRate],
  );
  const consultSvc = useMemo(
    () => ({ ...SVC_CONSULT_BASE, price: consultRate, kind: 'consult' }),
    [consultRate],
  );
  const svcPickerList = useMemo(() => [hourlySvc, consultSvc, ...MOCK_SERVICES], [hourlySvc, consultSvc]);

  const hourlyInQueue = useMemo(() => svcQueue.some((q) => q.id === 'SVC-HOURLY'), [svcQueue]);
  const consultInQueue = useMemo(() => svcQueue.some((q) => q.id === 'SVC-CONSULT'), [svcQueue]);

  useEffect(() => {
    setSvcQueue((prev) =>
      prev.map((s) => {
        if (s.id === 'SVC-HOURLY') return { ...s, price: hourlyRate };
        if (s.id === 'SVC-CONSULT') return { ...s, price: consultRate };
        return s;
      }),
    );
  }, [hourlyRate, consultRate]);

  const toggleSvcInQueue = useCallback((svc) => {
    setSvcQueue((prev) =>
      prev.some((q) => q.id === svc.id) ? prev.filter((q) => q.id !== svc.id) : [...prev, svc],
    );
  }, []);

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
      Boolean(el.closest('.s2-filmCluster--queue'));
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
            <div className="s2-filmRow s2-filmRow--services" aria-label="Services">
              <div className="s2-filmCluster s2-filmCluster--queue">
                <div className="s2-filmPinWrap">
                  <button
                    type="button"
                    className={`s2-filmPill s2-filmPill--svc s2-filmPill--hourly${hourlyInQueue ? ' is-svcPicked' : ''}`}
                    title={hourlySvc.name}
                    aria-pressed={hourlyInQueue}
                    aria-label={`${hourlySvc.name}, ${hourlyInQueue ? 'selected' : 'not selected'}`}
                    onClick={() => toggleSvcInQueue(hourlySvc)}
                  >
                    <span className="s2-filmPill__mono">{queuePriceLabel(hourlySvc)}</span>
                  </button>
                  {hourlyInQueue ? (
                    <button
                      type="button"
                      className="s2-filmRemoveBtn"
                      aria-label={`Remove ${hourlySvc.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openRemoveConfirm('svc', 'SVC-HOURLY', hourlySvc.name);
                      }}
                    >
                      <Minus size={11} weight="bold" aria-hidden />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="s2-filmPinWrap__edit"
                    aria-label="Set hourly rate"
                    onClick={() => setRateEditOpen('hourly')}
                  >
                    <PencilSimple size={11} weight="bold" aria-hidden />
                  </button>
                </div>
                <div className="s2-filmPinWrap">
                  <button
                    type="button"
                    className={`s2-filmPill s2-filmPill--svc s2-filmPill--consult${consultInQueue ? ' is-svcPicked' : ''}`}
                    title={consultSvc.name}
                    aria-pressed={consultInQueue}
                    aria-label={`${consultSvc.name}, ${consultInQueue ? 'selected' : 'not selected'}`}
                    onClick={() => toggleSvcInQueue(consultSvc)}
                  >
                    <span className="s2-filmPill__mono">{queuePriceLabel(consultSvc)}</span>
                  </button>
                  {consultInQueue ? (
                    <button
                      type="button"
                      className="s2-filmRemoveBtn"
                      aria-label={`Remove ${consultSvc.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openRemoveConfirm('svc', 'SVC-CONSULT', consultSvc.name);
                      }}
                    >
                      <Minus size={11} weight="bold" aria-hidden />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="s2-filmPinWrap__edit"
                    aria-label="Set consultation fee"
                    onClick={() => setRateEditOpen('consult')}
                  >
                    <PencilSimple size={11} weight="bold" aria-hidden />
                  </button>
                </div>
                {displaySvcRestQueue.map((s, i) => (
                  <div key={`${s.id}-row-${i}`} className="s2-filmItemWrap">
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
                    <div className="s2-filmPill s2-filmPill--svc s2-filmPill--queueExtra is-svcPicked" title={s.name}>
                      <span className="s2-filmPill__mono">{queuePriceLabel(s)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="s2-filmPlus s2-filmPlus--rail"
                aria-label="Add services"
                onClick={() => setAddServicesOpen(true)}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="s2-section">
          <div className="s2-pill s2-pill--neutral">Home Care</div>
          <div className="s2-card s2-card--v13 s2-hcCard">
            <div className="s2-filmRow s2-filmRow--products" aria-label="Home care products">
              <div className="s2-filmCluster s2-filmCluster--queue">
                {productQueue.map((p, i) => (
                  <div key={`${p.id}-row-${i}`} className="s2-filmItemWrap">
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
                    <div className="s2-filmPill s2-filmPill--prd" title={p.name}>
                      <span className="s2-filmPill__brand">{p.brand}</span>
                      <span className="s2-filmPill__mono">${p.price}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="s2-filmPlus s2-filmPlus--rail"
                aria-label="Add products"
                onClick={() => setAddProductsOpen(true)}
              >
                +
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
        <div className="s2-popupOverlay" role="dialog" aria-modal="true" aria-label="Consultation overlay">
          <button type="button" className="s2-popupBackdrop" aria-label="Close" onClick={() => { stopVoice(); setConsultOpen(false); }} />
          <div className="s2-popup">
            <div className="s2-popupTopbar">
              <button type="button" className="s2-popupClose" aria-label="Close" onClick={() => { stopVoice(); setConsultOpen(false); }}>×</button>
              <div className="s2-popupTitle">{activeClientName.toUpperCase()}</div>
              <div className="s2-popupSpacer" aria-hidden />
            </div>

            <div className="s2-popupBody">
              {CONSULT.panes.map((p) => {
                const isLook = p.key === 'LOOK';
                return (
                  <div key={p.key} className="s2-popPane">
                    <div className="s2-popPaneHeader">
                      <div className={`s2-popPaneLabel ${p.colorClass}`}>{p.key}</div>
                      {isLook ? (
                        <button
                          type="button"
                          className="s2-popCam is-look"
                          aria-label="Capture photo"
                          onClick={() => openPhotoPicker(null)}
                        >
                          <Camera size={16} weight="fill" aria-hidden />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`s2-popMic ${p.colorClass}`}
                          aria-label={`Add new ${p.key} note`}
                          onClick={() => openNoteEditor(p.key)}
                        >
                          <Microphone size={16} weight="fill" aria-hidden />
                        </button>
                      )}
                    </div>

                    {!isLook ? (
                      (() => {
                        const entries = consultRecord[p.key + '_entries'] || [];
                        const fallback =
                          (consultRecord[p.key] || '').trim() ||
                          CONSULT_DEFAULT_TEXT[p.key] ||
                          '';
                        if (entries.length === 0) {
                          // Render legacy / default seed text inside the same
                          // scrollable container so the visual stays consistent.
                          return (
                            <div className="s2-popPaneContent s2-popPaneLog">
                              <div className="s2-popPaneLogEntry">
                                <div className="s2-popPaneLogText">{fallback}</div>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="s2-popPaneContent s2-popPaneLog">
                            {entries.map((entry, idx) => (
                              <div
                                key={`${entry.ts}-${idx}`}
                                className={`s2-popPaneLogEntry${idx === 0 ? ' is-latest' : ''}`}
                              >
                                <div className="s2-popPaneLogStamp">{formatNoteStamp(entry.ts)}</div>
                                <div className="s2-popPaneLogText">{entry.text}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="s2-popLook">
                        <div className="s2-popLookGrid">
                          {[0, 1, 2, 3, 4, 5].map((slotIx) => {
                            const photo = consultRecord.photos?.[slotIx];
                            const baseTone = ['is-now', 'is-want', 'is-last'][slotIx];
                            if (photo?.url) {
                              return (
                                <button
                                  key={slotIx}
                                  type="button"
                                  className="s2-popLookCell s2-popLookCell--photo"
                                  aria-label={`Replace photo ${slotIx + 1}`}
                                  onClick={() => openPhotoPicker(slotIx)}
                                >
                                  <img
                                    src={photo.url}
                                    alt={`Look ${['NOW', 'WANT', 'LAST'][slotIx] || slotIx + 1}`}
                                    className="s2-popLookCell__img"
                                    draggable={false}
                                  />
                                </button>
                              );
                            }
                            if (slotIx < 3) {
                              return (
                                <button
                                  key={slotIx}
                                  type="button"
                                  className={`s2-popLookCell ${baseTone}`}
                                  aria-label={`Add ${['NOW', 'WANT', 'LAST'][slotIx]} photo`}
                                  onClick={() => openPhotoPicker(slotIx)}
                                />
                              );
                            }
                            return (
                              <button
                                key={slotIx}
                                type="button"
                                className="s2-popLookCell is-add"
                                aria-label="Add photo"
                                onClick={() => openPhotoPicker(slotIx)}
                              >
                                + ADD
                              </button>
                            );
                          })}
                        </div>
                        <div className="s2-popLookTags">
                          <div className="s2-popLookTag">NOW</div>
                          <div className="s2-popLookTag">WANT</div>
                          <div className="s2-popLookTag">LAST</div>
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
                    )}
                  </div>
                );
              })}
            </div>
          </div>
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
              <div className="s2-svcPickQueue__label">HOME CARE</div>
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
