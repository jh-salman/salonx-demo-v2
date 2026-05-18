// import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';
// import {
//   ArrowLeft,
//   ArrowRight,
//   Butterfly,
//   CalendarBlank,
//   Camera,
//   CaretRight,
//   Clock,
//   Image as ImageIcon,
//   Lightning,
//   Microphone,
//   Minus,
//   PencilSimple,
//   Plus,
//   Scissors,
//   User,
//   X,
//   Gear,
// } from 'phosphor-react';
// import { MOCK_CLIENTS } from '../../data/mockClients';
// import { MOCK_PRODUCTS } from '../../data/mockProducts';
// import { MOCK_SERVICES } from '../../data/mockServices';
// import {
//   deleteClientAvatar,
//   getClientAvatar,
//   putClientAvatar,
// } from '../../data/clientAvatarDb';
// import {
//   CLIENTS_CATALOG_UPDATED,
//   catalogAvatarForClient,
//   findClientInCatalog,
//   persistClientAvatarToCatalog,
//   refreshClientsCatalogCache,
//   uploadClientProfileImage,
// } from '../../data/clientProfileAvatar';
// import { isAppointmentsApiAvailable } from '../../data/v2AppointmentsApi';
// import { fetchServiceCatalog } from '../../data/calendarCatalogApi';
// import {
//   apptStateFromVisitPayload,
//   loadConsultStore,
//   loadRemoteAppointmentVisit,
//   loadRemoteConsultation,
//   mergeRemoteConsultIntoStore,
//   pauseRemoteConsultPersist,
//   pauseRemoteVisitPersist,
//   persistRemoteAppointmentVisit,
//   persistRemoteConsultation,
//   PRODUCTS_CATALOG_UPDATED,
//   refreshProductCatalogCache,
//   resumeRemoteConsultPersist,
//   resumeRemoteVisitPersist,
//   saveConsultStore,
//   visitPayloadFromApptState,
// } from '../../data/screen2RemoteStore';
// import {
//   apptStateKey,
//   buildAptNavPayload,
//   getApptState,
//   loadApptStateStore,
//   readPersistedScreen2Apt,
//   readPersistedScreen2From,
//   readScreen2WorkflowForApt,
//   saveApptStateStore,
//   SVC_CONSULT_BASE,
//   SVC_HOURLY_BASE,
//   writePersistedScreen2Apt,
//   writeScreen2WorkflowForApt,
// } from '../../data/appointmentStateStore';
// import { useTimers } from '../../context/TimersContext';
// import AppointmentTimerBox from '../../component/AppointmentTimerBox';
// import TimerModal from '../../component/TimerModal';
// import ConsultationBriefPopup from './ConsultationBriefPopup';
// import './s2.css';
// import './consultationBrief.css';

// const S2_ICON_TOOLBAR = 24;
// const S2_ICON_TOOLBAR_ACTIVE = 26;

// /** Screen2 header progress: CHECK → CONSULT → SERVICE → LIFT → REBOOK */
// const S2_WORKFLOW_STEPS = [
//   ['check', 'CHECK'],
//   ['consult', 'CONSULT'],
//   ['services', 'SERVICE'],
//   ['lift', 'LIFT'],
//   ['booking', 'REBOOK'],
// ];

// function emptyS2Workflow() {
//   return { check: false, consult: false, services: false, lift: false, booking: false };
// }

// const TOOLBAR_ACTIVE = 1;
// const TOOLBAR_ITEMS = [
//   { Icon: Scissors, label: 'Stylist', to: '/screen1' },
//   // Profile icon → Clients picker. Marked active on Screen2 since this screen
//   // is the "client" half of the Profile flow.
//   { Icon: User, label: 'Clients', to: '/clients' },
//   { Icon: Lightning, label: 'Checkout', to: '/climax' },
//   { Icon: CalendarBlank, label: 'Calendar', to: '/calendar' },
//   { Icon: Gear, label: 'Settings', to: '/settings' },
// ];

// const CLIENT = {
//   name: "Jon Klein",
//   phone: "541-556-6923",
// };

// const META = {
//   msgCount: 3,
// };

// /** Reference-image CREATE pills (static categories; tap = open services picker). */
// const S2V2_CREATE_CATEGORIES = ['COLOR', 'CUT', 'GLOSS', 'TREATMENT'];

// /** Reference-image CREATE "Suggested" chips. */
// const S2V2_CREATE_SUGGESTED = [
//   'Gloss Refresh',
//   'K18 Treatment',
//   'Haircut',
//   'Olaplex Standalone',
// ];

// /** Reference-image FINISH "Suggested" chips. */
// const S2V2_FINISH_SUGGESTED = [
//   'R+Co Dallas',
//   'K18 Detox Shampoo',
//   'Olaplex No.9',
//   'Moroccanoil Treatment',
// ];

// /** Default catalog products used as the FINISH row demo when the queue is empty. */
// const S2V2_FINISH_DEFAULT_PRODUCTS = [
//   {
//     id: 's2v2-finish-rco-deathvalley',
//     brand: 'R+CO',
//     name: 'Death Valley\nDry Shampoo',
//     price: 32,
//     color: '#a0a0a8',
//     imageUrl: 'https://www.randco.com/dw/image/v2/AAVF_PRD/on/demandware.static/-/Sites-randco-master-catalog/default/dw0d3a0e5e/images/2024/death-valley-dry-shampoo.png',
//   },
//   {
//     id: 's2v2-finish-rco-rockaway',
//     brand: 'R+CO',
//     name: 'Rockaway\nSalt Spray',
//     price: 29,
//     color: '#d8b67a',
//     imageUrl: 'https://www.randco.com/dw/image/v2/AAVF_PRD/on/demandware.static/-/Sites-randco-master-catalog/default/dw9dbf3e3f/images/2024/rockaway-salt-spray.png',
//   },
//   {
//     id: 's2v2-finish-olaplex-bonding',
//     brand: 'Olaplex',
//     name: 'Bonding Oil',
//     price: 30,
//     color: '#f0a533',
//     imageUrl: 'https://olaplex.com/cdn/shop/files/Olaplex_No7_BondingOil_30ml.png',
//   },
//   {
//     id: 's2v2-finish-k18-leavein',
//     brand: 'K18',
//     name: 'Leave-In\nMolecular Repair',
//     price: 75,
//     color: '#f5f5f5',
//     imageUrl: 'https://www.k18hair.com/cdn/shop/files/K18-Leave-In-Molecular-Repair-Hair-Mask-150ml.png',
//   },
// ];

// const CONSULT = {
//   lastVisitShort: '8.15.25',
//   duration: '45 min',
//   noteTag: 'YELLOW',
//   noteHint: '"next time"',
//   panes: [
//     {
//       key: 'LIFE',
//       colorClass: 'is-life',
//       text: 'Expecting twins in July  •  Cabin rebuild\nJennifer → FSU  •  Loves coffee & travel',
//     },
//     {
//       key: 'CHAIR',
//       colorClass: 'is-chair',
//       text: 'Root melt + balayage last visit\nKeeping it bright around the face\nWants softer grow-out  •  Low maintenance',
//     },
//     {
//       key: 'PATH',
//       colorClass: 'is-path',
//       text: 'Shades EQ 7N + 7WB\n20g 7N / 10g 7WB  •  10vol\nProcessed 20 min  •  Bond builder added',
//     },
//     { key: 'LOOK', colorClass: 'is-look', text: null },
//   ],
//   lookThumbs: [
//     { label: 'NOW', tone: 'now' },
//     { label: 'WANT', tone: 'want' },
//     { label: 'LAST', tone: 'last' },
//   ],
//   lookExtraCount: 2,
// };

// /** Adjustable dollar fields: $0–$310, $1 steps (hourly + consultation use same slider pattern) */
// const ADJ_RATE_MIN = 0;
// const ADJ_RATE_MAX = 310;

// function clampAdjustableRate(n) {
//   const v = Math.round(Number(n));
//   if (Number.isNaN(v)) return 0;
//   return Math.min(ADJ_RATE_MAX, Math.max(ADJ_RATE_MIN, v));
// }

// const SVC_VISUAL_GRADIENTS = [
//   'linear-gradient(165deg, #3d2418 0%, #0a0a0c 88%)',
//   'linear-gradient(165deg, #2a1824 0%, #0a0a0c 88%)',
//   'linear-gradient(165deg, #1e2830 0%, #0a0a0c 88%)',
//   'linear-gradient(165deg, #2a3020 0%, #0a0a0c 88%)',
//   'linear-gradient(165deg, #302018 0%, #0a0a0c 88%)',
//   'linear-gradient(165deg, #252030 0%, #0a0a0c 88%)',
// ];

// function svcGradientForIndex(i) {
//   return SVC_VISUAL_GRADIENTS[i % SVC_VISUAL_GRADIENTS.length];
// }

// function svcGradientForPickerId(id, pickerList) {
//   const ix = pickerList.findIndex((x) => x.id === id);
//   return svcGradientForIndex(ix >= 0 ? ix : 0);
// }

// /** Queue “deck” cards (reference UI): category line + duration heuristics from name */
// function inferSvcDeckCategory(name) {
//   const lower = String(name || '').toLowerCase();
//   if (lower.includes('haircut') || lower.includes("kids'")) return 'CUT';
//   if (
//     lower.includes('color') ||
//     lower.includes('balayage') ||
//     lower.includes('highlight') ||
//     lower.includes('gloss') ||
//     lower.includes('toner') ||
//     lower.includes('camouflage')
//   ) {
//     return 'COLOR';
//   }
//   if (lower.includes('blowout') || lower.includes('iron') || lower.includes('upd')) return 'STYLE';
//   if (
//     lower.includes('treatment') ||
//     lower.includes('repair') ||
//     lower.includes('keratin') ||
//     lower.includes('brazilian') ||
//     lower.includes('scalp') ||
//     lower.includes('perm') ||
//     lower.includes('conditioning')
//   ) {
//     return 'TREAT';
//   }
//   if (lower.includes('beard') || lower.includes('buzz') || lower.includes('bang')) return 'GROOM';
//   if (lower.includes('extension') || lower.includes('bridal') || lower.includes('trial')) return 'EVENT';
//   return 'SERVICE';
// }

// /** Short primary label (accent in quad tiles) — matches reference “COLOR SERVICE” style */
// function svcRefHeadline(name) {
//   const c = inferSvcDeckCategory(name);
//   const labels = {
//     CUT: 'CUT',
//     COLOR: 'COLOR',
//     STYLE: 'STYLE',
//     TREAT: 'TREATMENT',
//     GROOM: 'GROOM',
//     EVENT: 'EVENT',
//     SERVICE: 'SERVICE',
//   };
//   return labels[c] || c;
// }

// /** Deck tile primary line — service name (reference: BALAYAGE, ORIBE) */
// function svcDeckPrimaryTitle(s) {
//   if (!s) return '';
//   if (s.id === 'SVC-HOURLY' || s.kind === 'hourly') return 'HOURLY';
//   if (s.id === 'SVC-CONSULT' || s.kind === 'consult') return 'CONSULT';
//   return String(s.name).toUpperCase();
// }

// /** Deck tile secondary — category or rate type (reference: COLOR, grey) */
// function svcDeckSecondaryLine(s) {
//   if (!s) return '';
//   if (s.id === 'SVC-HOURLY' || s.kind === 'hourly') return 'TIME-BASED';
//   if (s.id === 'SVC-CONSULT' || s.kind === 'consult') return 'SESSION FEE';
//   return svcRefHeadline(s.name);
// }

// function inferSvcDurationMinutes(name) {
//   const lower = String(name || '').toLowerCase();
//   if ((lower.includes('bang') || lower.includes('beard')) && !lower.includes('haircut')) return 20;
//   if (lower.includes('kids')) return 30;
//   if (lower.includes('buzz')) return 25;
//   if (lower.includes('full balayage') || lower.includes('keratin') || lower.includes('brazilian') || lower.includes('tape-in')) {
//     return 180;
//   }
//   if (lower.includes('partial high') || lower.includes('full high') || lower.includes('double process')) return 150;
//   if (lower.includes('haircut') && !lower.includes('style')) return 45;
//   if (lower.includes('haircut')) return 60;
//   if (lower.includes('color') || lower.includes('blowout')) return 75;
//   return 60;
// }

// function formatSvcDurationShort(name) {
//   const m = inferSvcDurationMinutes(name);
//   if (m >= 60 && m % 60 === 0) return `${m / 60}h`;
//   if (m > 60) {
//     const h = Math.floor(m / 60);
//     const r = m % 60;
//     return r ? `${h}h${r}m` : `${h}h`;
//   }
//   return `${m}m`;
// }

// /** Hourly + consultation always first on card + queue footer */
// function sortSvcQueueForDisplay(queue) {
//   const hourly = queue.find((s) => s.id === 'SVC-HOURLY');
//   const consult = queue.find((s) => s.id === 'SVC-CONSULT');
//   const rest = queue.filter((s) => s.id !== 'SVC-HOURLY' && s.id !== 'SVC-CONSULT');
//   return [hourly, consult, ...rest].filter(Boolean);
// }

// function queuePriceLabel(s) {
//   if (s.id === 'SVC-HOURLY' || s.kind === 'hourly') return `$${s.price}/hr`;
//   if (String(s.id).startsWith('SVC-C')) return `$${s.price}/hr`;
//   return `$${s.price}`;
// }

// const ADD_PRODUCTS_BRAND = 'DANGER JONES';

// function productVisualGradient(color) {
//   return `linear-gradient(165deg, ${color} 0%, #0a0a0c 85%)`;
// }

// function productImageUrl(p) {
//   if (!p || typeof p.imageUrl !== 'string') return null;
//   const u = p.imageUrl.trim();
//   return u || null;
// }

// function serviceImageUrl(s) {
//   if (!s || typeof s !== 'object') return null;
//   const a = typeof s.image === 'string' ? s.image.trim() : '';
//   const b = typeof s.imageUrl === 'string' ? s.imageUrl.trim() : '';
//   return a || b || null;
// }

// /** Queue rows may omit `image` after older saves — resolve from picker catalog. */
// function serviceImageUrlResolved(s, pickerList) {
//   const direct = serviceImageUrl(s);
//   if (direct) return direct;
//   const id = s && s.id != null ? String(s.id) : '';
//   if (!id || !Array.isArray(pickerList)) return null;
//   const row = pickerList.find((x) => x && String(x.id) === id);
//   return serviceImageUrl(row);
// }

// /** Product packshot over `MOCK_PRODUCTS` `imageUrl`; gradient stays as fallback / underlay. */
// function S2ProductPhoto({ imageUrl, fallbackBackground, wrapClassName, imgClassName, decorative }) {
//   return (
//     <div
//       className={wrapClassName}
//       style={fallbackBackground ? { background: fallbackBackground } : undefined}
//       aria-hidden={decorative ? true : undefined}
//     >
//       {imageUrl ? (
//         <img
//           className={imgClassName}
//           src={imageUrl}
//           alt=""
//           loading="lazy"
//           decoding="async"
//           referrerPolicy="no-referrer"
//           onError={(e) => {
//             e.currentTarget.remove();
//           }}
//         />
//       ) : null}
//     </div>
//   );
// }

// // ---------- Consultation persistence (per-client, localStorage + API) ----------
// const CONSULT_DEFAULT_TEXT = {
//   LIFE: 'Sister-in-law expecting twins · cabin rebuild · Jennifer→FSU',
//   CHAIR: 'Redken Shades EQ 7N · 7WB · use more 7N next time',
//   PATH: 'Keep dimension · low maintenance · natural grow-out',
// };

// function clientKey(name) {
//   return (name || '').trim().toLowerCase();
// }

// // React Router drops `location.state` on full page refresh — Screen2 falls back
// // to `readPersistedScreen2Apt()` (sessionStorage) so LOOK photos / consult /
// // per-appointment service+product queues all stay tied to the right appointment.

// // Each pane (LIFE/CHAIR/PATH) stores a chronological log of notes — newest
// // entry first. The legacy single-string field (e.g. `rec.LIFE`) is kept for
// // backward compatibility and migrated into the entries array on first read.
// function migratePaneEntries(rec, key) {
//   const arr = rec[key + '_entries'];
//   if (Array.isArray(arr) && arr.length) {
//     const cleaned = arr
//       .filter((e) => e && typeof e.text === 'string' && e.text.trim())
//       .map((e) => ({ text: e.text, ts: typeof e.ts === 'number' ? e.ts : Date.now() }));
//     if (cleaned.length) return cleaned;
//   }
//   const legacy = typeof rec[key] === 'string' ? rec[key].trim() : '';
//   if (legacy) {
//     return [{ text: legacy, ts: typeof rec.updatedAt === 'number' ? rec.updatedAt : Date.now() }];
//   }
//   return [];
// }

// /** Legacy single-string field stays aligned with newest stored note (index 0). */
// function legacyFieldForPane(pane) {
//   if (pane === 'LIFE' || pane === 'CHAIR' || pane === 'PATH') return pane;
//   return null;
// }

// function getConsultRecord(store, name) {
//   const key = clientKey(name);
//   const rec = store[key] || {};
//   return {
//     LIFE: typeof rec.LIFE === 'string' ? rec.LIFE : CONSULT_DEFAULT_TEXT.LIFE,
//     CHAIR: typeof rec.CHAIR === 'string' ? rec.CHAIR : CONSULT_DEFAULT_TEXT.CHAIR,
//     PATH: typeof rec.PATH === 'string' ? rec.PATH : CONSULT_DEFAULT_TEXT.PATH,
//     LIFE_entries: migratePaneEntries(rec, 'LIFE'),
//     CHAIR_entries: migratePaneEntries(rec, 'CHAIR'),
//     PATH_entries: migratePaneEntries(rec, 'PATH'),
//     photos: Array.isArray(rec.photos) ? rec.photos : [], // [{ url, ts, label }]
//     avatar: typeof rec.avatar === 'string' && rec.avatar ? rec.avatar : null,
//     avatarDataKey:
//       typeof rec.avatarDataKey === 'string' && rec.avatarDataKey.trim()
//         ? rec.avatarDataKey.trim()
//         : null,
//     updatedAt: rec.updatedAt || null,
//   };
// }

// // Format a timestamp like "MAY 1 · 9:42 PM"
// function formatNoteStamp(ts) {
//   if (!ts) return '';
//   const d = new Date(ts);
//   const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
//   let h = d.getHours();
//   const m = d.getMinutes();
//   const ampm = h >= 12 ? 'PM' : 'AM';
//   h = h % 12; if (h === 0) h = 12;
//   return `${months[d.getMonth()]} ${d.getDate()} · ${h}:${String(m).padStart(2, '0')} ${ampm}`;
// }

// /** Compact date for note rows: 3.18.25 */
// function formatNoteDateShort(ts) {
//   if (!ts) return '—';
//   const d = new Date(ts);
//   return `${d.getMonth() + 1}.${d.getDate()}.${String(d.getFullYear()).slice(-2)}`;
// }

// function monthsSinceOldestEntry(entries) {
//   if (!Array.isArray(entries) || !entries.length) return null;
//   const oldest = entries.reduce((min, e) => Math.min(min, e.ts || Date.now()), entries[0].ts);
//   const mo = (Date.now() - oldest) / (1000 * 60 * 60 * 24 * 30);
//   return Math.max(1, Math.round(mo));
// }

// function visitOrdinalLabel(lifeEntryCount, isNewClient) {
//   if (isNewClient) return '1ST VISIT';
//   const n = Math.min(99, Math.max(2, 2 + lifeEntryCount));
//   const map = { 1: '1ST', 2: '2ND', 3: '3RD', 4: '4TH', 5: '5TH', 6: '6TH', 7: '7TH', 8: '8TH', 9: '9TH', 10: '10TH' };
//   return `${map[n] || `${n}TH`} VISIT`;
// }

// /** Storage is newest-first; prototype shows oldest→newest with latest at bottom */
// function chronologicalForFeed(entries, fallbackText) {
//   if (Array.isArray(entries) && entries.length) {
//     return [...entries].reverse();
//   }
//   if (fallbackText && String(fallbackText).trim()) {
//     return [{ text: String(fallbackText).trim(), ts: null }];
//   }
//   return [];
// }

// // Same key / event as Calendar.jsx — service list in picker stays in sync when
// // catalog changes (new service from Calendar, etc.).
// const CALENDAR_V1_STORAGE_KEY = '@salonx/calendar/v1';
// const CALENDAR_UPDATED_EVENT = 'salonx:calendar-updated';

// function normalizeServiceCatalogEntry(raw) {
//   if (!raw || typeof raw !== 'object') return null;
//   const id = raw.id != null ? String(raw.id) : '';
//   const name = typeof raw.name === 'string' ? raw.name.trim() : '';
//   if (!id || !name) return null;
//   const price = typeof raw.price === 'number' && !Number.isNaN(raw.price) ? raw.price : 0;
//   const out = { id, name, price };
//   const img = typeof raw.image === 'string' ? raw.image.trim() : '';
//   if (img) out.image = img;
//   if (raw.kind) out.kind = raw.kind;
//   return out;
// }

// function enrichServiceCatalogImages(catalog) {
//   const byId = Object.fromEntries(MOCK_SERVICES.map((s) => [s.id, s]));
//   return catalog.map((row) => {
//     const m = byId[row.id];
//     if (m && typeof m.image === 'string' && m.image.trim() && !serviceImageUrl(row)) {
//       return { ...row, image: m.image.trim() };
//     }
//     return row;
//   });
// }

// function loadServiceCatalogFromCalendarStorage() {
//   if (typeof window === 'undefined') return MOCK_SERVICES;
//   try {
//     const json = window.localStorage.getItem(CALENDAR_V1_STORAGE_KEY);
//     if (!json) return MOCK_SERVICES;
//     const data = JSON.parse(json);
//     const cat = data?.serviceCatalog;
//     if (!Array.isArray(cat) || !cat.length) return MOCK_SERVICES;
//     const normalized = cat.map(normalizeServiceCatalogEntry).filter(Boolean);
//     if (!normalized.length) return MOCK_SERVICES;
//     return enrichServiceCatalogImages(normalized);
//   } catch {
//     return MOCK_SERVICES;
//   }
// }

// // Per-appointment services/products live in `data/appointmentStateStore.js`.
// // Imported above so Climax + Stylist share the exact same source of truth.

// // Web Speech API factory — returns recognition instance or null if unsupported
// function createRecognition() {
//   if (typeof window === 'undefined') return null;
//   const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
//   if (!Ctor) return null;
//   const r = new Ctor();
//   r.continuous = true;
//   r.interimResults = true;
//   r.lang = 'en-US';
//   return r;
// }

// export default function Screen2() {
//   const navigate = useNavigate();
//   const location = useLocation();

//   // Resolve appointment + client from nav state (Calendar single-tap passes `apt`).
//   // After a full refresh, `state` is gone — fall back to last apt saved for this tab.
//   const activeAptFromNav = location?.state?.apt || null;
//   const activeApt = activeAptFromNav || readPersistedScreen2Apt() || null;

//   // Where the user came from — used by the top-left Back button so it returns
//   // to the right origin (Calendar vs Stylist). Persisted in session so a full
//   // refresh on Screen2 still routes Back to the correct screen.
//   const fromFromNav = (location?.state?.from && String(location.state.from)) || null;
//   const backTarget = fromFromNav || readPersistedScreen2From() || '/screen1';

//   useEffect(() => {
//     if (activeAptFromNav) writePersistedScreen2Apt(activeAptFromNav, fromFromNav);
//   }, [activeAptFromNav, fromFromNav]);

//   const activeClientName = useMemo(() => {
//     const fromNav = activeApt?.clientName;
//     return (fromNav && String(fromNav).trim()) || CLIENT.name;
//   }, [activeApt]);

//   const [catalogClients, setCatalogClients] = useState([]);
//   const [productCatalog, setProductCatalog] = useState(MOCK_PRODUCTS);
//   useEffect(() => {
//     if (!isAppointmentsApiAvailable()) return;
//     let cancelled = false;
//     void refreshClientsCatalogCache().then((list) => {
//       if (!cancelled && list) setCatalogClients(list);
//     });
//     const onCatalog = () => {
//       void refreshClientsCatalogCache().then((list) => {
//         if (list) setCatalogClients(list);
//       });
//     };
//     window.addEventListener(CLIENTS_CATALOG_UPDATED, onCatalog);
//     return () => {
//       cancelled = true;
//       window.removeEventListener(CLIENTS_CATALOG_UPDATED, onCatalog);
//     };
//   }, []);

//   useEffect(() => {
//     if (!isAppointmentsApiAvailable()) {
//       setProductCatalog(MOCK_PRODUCTS);
//       return undefined;
//     }
//     let cancelled = false;
//     void refreshProductCatalogCache().then((list) => {
//       if (!cancelled && list?.length) setProductCatalog(list);
//     });
//     const onProducts = () => {
//       void refreshProductCatalogCache().then((list) => {
//         if (list?.length) setProductCatalog(list);
//       });
//     };
//     window.addEventListener(PRODUCTS_CATALOG_UPDATED, onProducts);
//     return () => {
//       cancelled = true;
//       window.removeEventListener(PRODUCTS_CATALOG_UPDATED, onProducts);
//     };
//   }, []);

//   // DB catalog first, then mock — includes `avatar` URL from Postgres.
//   const activeClient = useMemo(() => {
//     const fromCatalog = findClientInCatalog({ name: activeClientName });
//     if (fromCatalog) return fromCatalog;
//     const target = activeClientName.toLowerCase();
//     const match = MOCK_CLIENTS.find(
//       (c) => (c.name || '').toLowerCase() === target,
//     );
//     return match || { name: activeClientName, phone: '', email: '' };
//   }, [activeClientName, catalogClients]);

//   // Derived display values for the appointment we navigated from
//   const activeApptInfo = useMemo(() => {
//     if (!activeApt || !activeApt.start || !activeApt.end) return null;
//     const start = new Date(activeApt.start);
//     const end = new Date(activeApt.end);
//     const dur = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
//     const dateShort = `${start.getMonth() + 1}.${start.getDate()}.${String(start.getFullYear()).slice(-2)}`;
//     return {
//       dateShort,
//       durationLabel: dur ? `${dur} min` : '',
//       service: activeApt.service || '',
//     };
//   }, [activeApt]);

//   const isNewClient = useMemo(() => {
//     const target = activeClientName.toLowerCase();
//     return !MOCK_CLIENTS.some((c) => (c.name || '').toLowerCase() === target);
//   }, [activeClientName]);

//   // Consultation notes per client, persisted to localStorage
//   const [consultRecord, setConsultRecord] = useState(() =>
//     getConsultRecord(loadConsultStore(), activeClientName),
//   );

//   const consultRecordRef = useRef(consultRecord);
//   consultRecordRef.current = consultRecord;

//   // Reload record if active client changes (local + remote when API available)
//   useEffect(() => {
//     const key = clientKey(activeClientName);
//     setConsultRecord(getConsultRecord(loadConsultStore(), activeClientName));
//     if (!isAppointmentsApiAvailable()) return undefined;
//     let cancelled = false;
//     void loadRemoteConsultation(activeClientName).then((data) => {
//       if (cancelled || !data?.stored || !data.record) return;
//       pauseRemoteConsultPersist();
//       const { store, didMerge } = mergeRemoteConsultIntoStore(
//         key,
//         data.record,
//         consultRecordRef.current,
//       );
//       if (didMerge) {
//         setConsultRecord(getConsultRecord(store, activeClientName));
//       }
//       window.setTimeout(() => resumeRemoteConsultPersist(), 400);
//     });
//     return () => {
//       cancelled = true;
//     };
//   }, [activeClientName]);

//   /** Profile photo sheet (camera / library); avatar persists per client via consultation store. */
//   const [avatarPhotoSheetOpen, setAvatarPhotoSheetOpen] = useState(false);

//   const [avatarIdbUrl, setAvatarIdbUrl] = useState(null);

//   const profilePhotoDisplayUrl =
//     (typeof consultRecord.avatar === 'string' && consultRecord.avatar.trim()
//       ? consultRecord.avatar
//       : null) ||
//     catalogAvatarForClient(activeClient) ||
//     (typeof avatarIdbUrl === 'string' && avatarIdbUrl.trim() ? avatarIdbUrl : null);

//   useEffect(() => {
//     const inline =
//       typeof consultRecord.avatar === 'string' && consultRecord.avatar.trim();
//     if (inline) {
//       setAvatarIdbUrl(null);
//       return undefined;
//     }
//     const key = clientKey(activeClientName);
//       const store = loadConsultStore();
//     const rawRow = store[key] || {};
//     const idbKey =
//       (typeof rawRow.avatarDataKey === 'string' && rawRow.avatarDataKey.trim()) || key;
//     let cancelled = false;
//     getClientAvatar(idbKey).then((url) => {
//       if (cancelled) return;
//       setAvatarIdbUrl(typeof url === 'string' && url ? url : null);
//     });
//     return () => {
//       cancelled = true;
//     };
//   }, [activeClientName, consultRecord.avatar, consultRecord.avatarDataKey]);

//   // Debounced persistence (large data: URLs go to IndexedDB; LS keeps a pointer only)
//   useEffect(() => {
//     const t = setTimeout(() => {
//       void (async () => {
//         const store = loadConsultStore();
//         const key = clientKey(activeClientName);
//         const raw = { ...consultRecordRef.current, updatedAt: Date.now() };
//         const av = typeof raw.avatar === 'string' ? raw.avatar.trim() : '';
//         const idbKeyExisting =
//           typeof raw.avatarDataKey === 'string' && raw.avatarDataKey.trim()
//             ? raw.avatarDataKey.trim()
//             : null;

//         if (av.startsWith('data:')) {
//           try {
//             await putClientAvatar(key, av);
//             raw.avatar = '';
//             raw.avatarDataKey = key;
//           } catch (_) {
//             /* keep inline if IDB fails */
//           }
//         } else if (av.startsWith('http://') || av.startsWith('https://')) {
//           if (idbKeyExisting) {
//             try {
//               await deleteClientAvatar(idbKeyExisting);
//             } catch (_) {
//               /* noop */
//             }
//           }
//           raw.avatarDataKey = null;
//           try {
//             await persistClientAvatarToCatalog({
//               clientId: activeClient.id,
//               name: activeClientName,
//               avatarUrl: av,
//             });
//           } catch (_) {
//             /* noop */
//           }
//         } else if (!av) {
//           if (!idbKeyExisting) {
//             try {
//               await deleteClientAvatar(key);
//             } catch (_) {
//               /* noop */
//             }
//             raw.avatarDataKey = null;
//           }
//           raw.avatar = '';
//           try {
//             await persistClientAvatarToCatalog({
//               clientId: activeClient.id,
//               name: activeClientName,
//               avatarUrl: '',
//             });
//           } catch (_) {
//             /* noop */
//           }
//         }

//         store[key] = raw;
//       saveConsultStore(store);
//         if (isAppointmentsApiAvailable()) {
//           try {
//             await persistRemoteConsultation(activeClientName, raw);
//           } catch (_) {
//             /* noop */
//           }
//         }
//       })();
//     }, 250);
//     return () => clearTimeout(t);
//   }, [consultRecord, activeClientName, activeClient.id]);

//   // ---------- New-note popup (per pane) ----------
//   // Tap the mic on a pane → opens a modal where the user composes a brand-new
//   // note (typed and/or dictated). Pressing "Update" prepends it to the pane's
//   // entries log. The pane area itself stays read-only & scrollable so the
//   // stylist can swipe to see older notes without touching them.
//   // { pane, mode: 'new'|'edit', entryIndex?, entryTs?, synthetic? }
//   const [noteEditOpen, setNoteEditOpen] = useState(null);
//   const [noteDraft, setNoteDraft] = useState('');
//   const noteDraftRef = useRef('');
//   const noteEditOpenRef = useRef(null);
//   // Step-through: some progress markers are decided by actions that happen
//   // earlier in the file than the workflow state is declared (hook order).
//   // We bridge via a ref so "Update note" can light CONSULT.
//   const s2WorkflowMarkRef = useRef({ consult: () => {} });
//   useEffect(() => {
//     noteDraftRef.current = noteDraft;
//   }, [noteDraft]);
//   useEffect(() => {
//     noteEditOpenRef.current = noteEditOpen;
//   }, [noteEditOpen]);

//   const [consultOpen, setConsultOpen] = useState(false);
//   const [preBriefOpen, setPreBriefOpen] = useState(false);

//   // ---------- Voice recording (Web Speech API) — into the new-note draft ----
//   const [recordingPane, setRecordingPane] = useState(null); // pane key being dictated
//   const recognitionRef = useRef(null);
//   const recordBaselineRef = useRef(''); // draft text before recording started

//   const stopVoice = useCallback(() => {
//     const rec = recognitionRef.current;
//     if (rec) {
//       try { rec.onresult = null; rec.onerror = null; rec.onend = null; rec.stop(); } catch (_) { /* noop */ }
//     }
//     recognitionRef.current = null;
//     setRecordingPane(null);
//   }, []);

//   const startVoice = useCallback((paneKey) => {
//     const rec = createRecognition();
//     if (!rec) return; // browser doesn't support — silently no-op
//     recordBaselineRef.current = '';
//     setNoteDraft((d) => {
//       recordBaselineRef.current = d || '';
//       return d;
//     });
//     rec.onresult = (e) => {
//       let interim = '';
//       let final = '';
//       for (let i = e.resultIndex; i < e.results.length; i += 1) {
//         const t = e.results[i][0].transcript;
//         if (e.results[i].isFinal) final += t;
//         else interim += t;
//       }
//       const baseline = recordBaselineRef.current || '';
//       const sep = baseline && !baseline.endsWith(' ') ? ' ' : '';
//       const next = baseline + sep + (final || interim);
//       setNoteDraft(next.trim());
//       if (final) recordBaselineRef.current = next.trim();
//     };
//     rec.onerror = () => stopVoice();
//     rec.onend = () => {
//       recognitionRef.current = null;
//       setRecordingPane(null);
//     };
//     try {
//       rec.start();
//       recognitionRef.current = rec;
//       setRecordingPane(paneKey);
//     } catch (_) {
//       stopVoice();
//     }
//   }, [stopVoice]);

//   const toggleVoice = useCallback((paneKey) => {
//     if (recordingPane === paneKey) {
//       stopVoice();
//     } else {
//       if (recognitionRef.current) stopVoice();
//       startVoice(paneKey);
//     }
//   }, [recordingPane, startVoice, stopVoice]);

//   const openNewNote = useCallback((paneKey) => {
//     stopVoice();
//     setNoteDraft('');
//     setNoteEditOpen({ pane: paneKey, mode: 'new' });
//   }, [stopVoice]);

//   /** Opens the composer and starts dictation on the next frame (mic header buttons). */
//   const openNewNoteWithVoice = useCallback((paneKey) => {
//     stopVoice();
//     setNoteDraft('');
//     setNoteEditOpen({ pane: paneKey, mode: 'new' });
//     requestAnimationFrame(() => startVoice(paneKey));
//   }, [startVoice, stopVoice]);

//   // Save: new entry prepends; edit replaces the row (or seeds first stored row from defaults).
//   // Refs avoid a stale `noteDraft` / `noteEditOpen` if the user taps Update on the same tick as typing (mobile).
//   const submitNoteDraft = useCallback(() => {
//     const meta = noteEditOpenRef.current;
//     if (!meta) return;
//     const text = (noteDraftRef.current || '').trim();
//     if (!text) {
//       stopVoice();
//       setNoteEditOpen(null);
//       return;
//     }
//     const { pane, mode, entryIndex, entryTs, synthetic } = meta;
//     const key = pane + '_entries';
//     const ts = Date.now();
//     const leg = legacyFieldForPane(pane);

//     if (mode === 'edit' && synthetic === true) {
//       setConsultRecord((prev) => {
//         const nextEntries = [{ text, ts }];
//         const next = { ...prev, [key]: nextEntries };
//         if (leg) next[leg] = text;
//         return next;
//       });
//     } else if (
//       mode === 'edit' &&
//       Number.isInteger(entryIndex) &&
//       entryIndex >= 0 &&
//       synthetic !== true
//     ) {
//       setConsultRecord((prev) => {
//         const existing = Array.isArray(prev[key]) ? [...prev[key]] : [];
//         let ix = entryIndex;
//         if (typeof entryTs === 'number' && !Number.isNaN(entryTs)) {
//           const found = existing.findIndex((e) => e && e.ts === entryTs);
//           if (found >= 0) ix = found;
//         }
//         if (ix < 0 || ix >= existing.length || !existing[ix]) return prev;
//         existing[ix] = { ...existing[ix], text, ts };
//         const next = { ...prev, [key]: existing };
//         if (leg && existing[0]?.text != null) next[leg] = String(existing[0].text);
//         return next;
//       });
//     } else {
//       setConsultRecord((prev) => {
//         const existing = Array.isArray(prev[key]) ? prev[key] : [];
//         const nextEntries = [{ text, ts }, ...existing];
//         const next = { ...prev, [key]: nextEntries };
//         if (leg) next[leg] = text;
//         return next;
//       });
//     }
//     // A real interaction occurred (added/updated a note) — now light CONSULT.
//     s2WorkflowMarkRef.current.consult?.();
//     stopVoice();
//     setNoteDraft('');
//     setNoteEditOpen(null);
//   }, [stopVoice]);

//   const cancelNoteDraft = useCallback(() => {
//     stopVoice();
//     setNoteDraft('');
//     setNoteEditOpen(null);
//   }, [stopVoice]);

//   const closeConsultBrief = useCallback(() => {
//     stopVoice();
//     setNoteDraft('');
//     setNoteEditOpen(null);
//     setPreBriefOpen(false);
//     setConsultOpen(false);
//   }, [stopVoice]);

//   useEffect(() => {
//     if (consultOpen) setPreBriefOpen(false);
//   }, [consultOpen]);

//   const lifeChron = useMemo(
//     () =>
//       chronologicalForFeed(
//         consultRecord.LIFE_entries,
//         !consultRecord.LIFE_entries?.length
//           ? (consultRecord.LIFE || '').trim() || CONSULT_DEFAULT_TEXT.LIFE
//           : '',
//       ),
//     [consultRecord],
//   );

//   const chairChron = useMemo(
//     () =>
//       chronologicalForFeed(
//         consultRecord.CHAIR_entries,
//         !consultRecord.CHAIR_entries?.length
//           ? (consultRecord.CHAIR || '').trim() || CONSULT_DEFAULT_TEXT.CHAIR
//           : '',
//       ),
//     [consultRecord],
//   );

//   const pathChron = useMemo(
//     () =>
//       chronologicalForFeed(
//         consultRecord.PATH_entries,
//         !consultRecord.PATH_entries?.length
//           ? (consultRecord.PATH || '').trim() || CONSULT_DEFAULT_TEXT.PATH
//           : '',
//       ),
//     [consultRecord],
//   );

//   const photosChron = useMemo(() => {
//     const p = [...(consultRecord.photos || [])].filter((x) => x && x.url);
//     p.sort((a, b) => (a.ts || 0) - (b.ts || 0));
//     return p;
//   }, [consultRecord.photos]);

//   const preSummary = useMemo(() => {
//     const n = (activeApt?.notes && String(activeApt.notes).trim()) || '';
//     const svc = activeApt?.service ? String(activeApt.service).trim() : '';
//     let s = '';
//     if (n && svc) s = `${n} · ${svc}`;
//     else s = n || svc || (isNewClient ? 'New appointment — screening & intake' : 'No pre-visit notes yet');
//     return s.length > 64 ? `${s.slice(0, 64)}…` : s;
//   }, [activeApt, isNewClient]);

//   const prePillKind = CONSULT.noteTag === 'YELLOW' ? 'alert' : isNewClient ? 'new' : 'returning';

//   const returningSuffix = useMemo(() => {
//     const mo = monthsSinceOldestEntry(consultRecord.LIFE_entries);
//     if (isNewClient || !mo) return '';
//     return ` · ${mo}MO`;
//   }, [consultRecord.LIFE_entries, isNewClient]);

//   const visitMetaLine = useMemo(
//     () =>
//       `${activeClient.phone || '—'} · ${visitOrdinalLabel(consultRecord.LIFE_entries?.length || 0, isNewClient)}`,
//     [activeClient.phone, consultRecord.LIFE_entries, isNewClient],
//   );

//   const todayBriefLine = useMemo(() => {
//     if (!activeApt?.start) return null;
//     const s = new Date(activeApt.start);
//     const parts = [activeApt.service || 'Appointment', activeApptInfo?.durationLabel, formatNoteStamp(s.getTime())].filter(
//       Boolean,
//     );
//     return parts.join(' · ');
//   }, [activeApt, activeApptInfo]);


//   // Stop recording when consult popup unmounts
//   useEffect(() => {
//     if (!recognitionRef.current) return;
//     return () => stopVoice();
//   }, [stopVoice]);

//   // ---------- Photo capture (LOOK pane) ----------
//   // Two hidden inputs: one with `capture` for the camera, one without for the
//   // photo library. A small action sheet lets the user pick which source to use
//   // so they can either take a fresh photo or upload one from their camera roll.
//   const photoInputRef = useRef(null); // camera (capture="environment")
//   const photoGalleryInputRef = useRef(null); // library (no capture)
//   const photoSlotRef = useRef(null); // index of slot being filled, or null = next free
//   const [lookPhotoSheetOpen, setLookPhotoSheetOpen] = useState(false);

//   const openPhotoPicker = useCallback((slotIndex) => {
//     photoSlotRef.current = typeof slotIndex === 'number' ? slotIndex : null;
//     setLookPhotoSheetOpen(true);
//   }, []);

//   /**
//    * Open the note editor on a specific stored entry (newest-first popup row order).
//    * `entries` storage shape matches `displayIdx` so we forward the index 1:1.
//    */
//   const onEditPaneEntry = useCallback(
//     (paneKey, entry, displayIdx) => {
//       stopVoice();
//       const entries =
//         paneKey === 'LIFE'
//           ? consultRecord.LIFE_entries
//           : paneKey === 'CHAIR'
//             ? consultRecord.CHAIR_entries
//             : consultRecord.PATH_entries;
//       const hasStored = Array.isArray(entries) && entries.length > 0;
//       const synthetic = !hasStored || entry?._synthetic;
//       setNoteDraft(entry?.text || '');
//       if (synthetic) {
//         setNoteEditOpen({ pane: paneKey, mode: 'edit', synthetic: true });
//       } else {
//         setNoteEditOpen({
//           pane: paneKey,
//           mode: 'edit',
//           entryIndex: displayIdx,
//           entryTs: typeof entry?.ts === 'number' ? entry.ts : undefined,
//         });
//       }
//     },
//     [consultRecord.LIFE_entries, consultRecord.CHAIR_entries, consultRecord.PATH_entries, stopVoice],
//   );

//   /** Map popup photo (from `photosChron`) back to its index in `consultRecord.photos`. */
//   const onEditPhotoEntry = useCallback(
//     (photo) => {
//       if (!photo) {
//         openPhotoPicker(null);
//         return;
//       }
//       const origIx = (consultRecord.photos || []).findIndex(
//         (p) => p && p.url === photo.url && (p.ts || 0) === (photo.ts || 0),
//       );
//       openPhotoPicker(origIx >= 0 ? origIx : null);
//     },
//     [consultRecord.photos, openPhotoPicker],
//   );

//   const openConsultPaneEdit = useCallback(
//     (paneKey) => {
//       stopVoice();
//       if (paneKey === 'LOOK') {
//         openPhotoPicker(null);
//         return;
//       }
//       const chron =
//         paneKey === 'LIFE' ? lifeChron : paneKey === 'CHAIR' ? chairChron : pathChron;
//       const entries =
//         paneKey === 'LIFE'
//           ? consultRecord.LIFE_entries
//           : paneKey === 'CHAIR'
//             ? consultRecord.CHAIR_entries
//             : consultRecord.PATH_entries;
//       if (!chron.length) {
//         openNewNote(paneKey);
//         return;
//       }
//       const entry = chron[chron.length - 1];
//       const hasStored = Array.isArray(entries) && entries.length > 0;
//       const synthetic = !hasStored;
//       const storageIdx = hasStored ? entries.length - 1 : -1;
//       setNoteDraft(entry.text || '');
//       if (synthetic) {
//         setNoteEditOpen({ pane: paneKey, mode: 'edit', synthetic: true });
//       } else {
//         setNoteEditOpen({
//           pane: paneKey,
//           mode: 'edit',
//           entryIndex: storageIdx,
//           entryTs: typeof entry.ts === 'number' ? entry.ts : undefined,
//         });
//       }
//     },
//     [
//       chairChron,
//       consultRecord.CHAIR_entries,
//       consultRecord.LIFE_entries,
//       consultRecord.PATH_entries,
//       lifeChron,
//       openNewNote,
//       openPhotoPicker,
//       pathChron,
//       stopVoice,
//     ],
//   );

//   const consultPaneDisplayText = useCallback(
//     (paneKey) => {
//       if (paneKey === 'LOOK') return '';
//       const chron =
//         paneKey === 'LIFE' ? lifeChron : paneKey === 'CHAIR' ? chairChron : pathChron;
//       if (chron.length) return (chron[chron.length - 1].text || '').trim();
//       const leg = (consultRecord[paneKey] || '').trim();
//       if (leg) return leg;
//       const def = CONSULT.panes.find((p) => p.key === paneKey);
//       return (def?.text || '').trim();
//     },
//     [chairChron, consultRecord, lifeChron, pathChron],
//   );

//   const triggerLookCamera = useCallback(() => {
//     setLookPhotoSheetOpen(false);
//     requestAnimationFrame(() => {
//       const input = photoInputRef.current;
//       if (input) {
//         input.value = '';
//         input.click();
//       }
//     });
//   }, []);

//   const triggerLookGallery = useCallback(() => {
//     setLookPhotoSheetOpen(false);
//     requestAnimationFrame(() => {
//       const input = photoGalleryInputRef.current;
//       if (input) {
//         input.value = '';
//         input.click();
//       }
//     });
//   }, []);

//   const handlePhotoChosen = useCallback((e) => {
//     const file = e.target?.files?.[0];
//     if (!file) return;
//     const input = e.target;
//     const slot = photoSlotRef.current;

//     const applyPhotoUrl = (url) => {
//       setConsultRecord((prev) => {
//         const photos = Array.isArray(prev.photos) ? [...prev.photos] : [];
//         const item = { url, ts: Date.now() };
//         if (typeof slot === 'number' && slot >= 0 && slot < photos.length) {
//           photos[slot] = { ...photos[slot], ...item };
//         } else {
//           photos.push(item);
//         }
//         return { ...prev, photos, updatedAt: Date.now() };
//       });
//       requestAnimationFrame(() => {
//         try {
//           if (input) input.blur();
//         } catch (_) {
//           /* noop */
//         }
//       });
//     };

//     if (isAppointmentsApiAvailable()) {
//       void (async () => {
//         try {
//           const remoteUrl = await uploadClientProfileImage(file);
//           applyPhotoUrl(remoteUrl);
//           return;
//         } catch (err) {
//           console.warn('[Screen2] LOOK photo upload failed', err);
//         }
//         const reader = new FileReader();
//         reader.onload = () => applyPhotoUrl(reader.result);
//         reader.readAsDataURL(file);
//       })();
//       return;
//     }

//     const reader = new FileReader();
//     reader.onload = () => applyPhotoUrl(reader.result);
//     reader.readAsDataURL(file);
//   }, []);

//   // ---------- Profile photo (header) — modal + camera / library; session-only (no persist) ----------
//   const avatarCameraInputRef = useRef(null);
//   const avatarGalleryInputRef = useRef(null);

//   const openAvatarPhotoSheet = useCallback(() => {
//     setAvatarPhotoSheetOpen(true);
//   }, []);

//   const triggerAvatarCamera = useCallback(() => {
//     setAvatarPhotoSheetOpen(false);
//     requestAnimationFrame(() => {
//       const input = avatarCameraInputRef.current;
//       if (input) {
//         input.value = '';
//         input.click();
//       }
//     });
//   }, []);

//   const triggerAvatarGallery = useCallback(() => {
//     setAvatarPhotoSheetOpen(false);
//     requestAnimationFrame(() => {
//       const input = avatarGalleryInputRef.current;
//       if (input) {
//         input.value = '';
//         input.click();
//       }
//     });
//   }, []);

//   const handleAvatarFileChosen = useCallback(
//     (e) => {
//     const file = e.target?.files?.[0];
//     const input = e.target;
//     if (!file) return;

//       const finish = () => {
//       setAvatarPhotoSheetOpen(false);
//       requestAnimationFrame(() => {
//         try {
//           if (input) input.blur();
//         } catch (_) {
//           /* noop */
//         }
//       });
//       };

//       if (isAppointmentsApiAvailable()) {
//         void (async () => {
//           try {
//             const remoteUrl = await uploadClientProfileImage(file);
//             setConsultRecord((prev) => ({ ...prev, avatar: remoteUrl }));
//             await persistClientAvatarToCatalog({
//               clientId: activeClient.id,
//               name: activeClientName,
//               avatarUrl: remoteUrl,
//             });
//             finish();
//             return;
//           } catch (err) {
//             console.warn('[Screen2] profile photo upload failed', err);
//           }
//           const reader = new FileReader();
//           reader.onload = () => {
//             const url = reader.result;
//             if (typeof url === 'string') {
//               setConsultRecord((prev) => ({ ...prev, avatar: url }));
//             }
//             finish();
//     };
//     reader.readAsDataURL(file);
//         })();
//         return;
//       }

//       const reader = new FileReader();
//       reader.onload = () => {
//         const url = reader.result;
//         if (typeof url === 'string') {
//           setConsultRecord((prev) => ({ ...prev, avatar: url }));
//         }
//         finish();
//       };
//       reader.readAsDataURL(file);
//     },
//     [activeClient.id, activeClientName],
//   );

//   const [addServicesOpen, setAddServicesOpen] = useState(false);
//   const [addProductsOpen, setAddProductsOpen] = useState(false);
//   const [rateEditOpen, setRateEditOpen] = useState(null);

//   const [serviceCatalogList, setServiceCatalogList] = useState(loadServiceCatalogFromCalendarStorage);
//   useEffect(() => {
//     if (isAppointmentsApiAvailable()) {
//       let cancelled = false;
//       void fetchServiceCatalog().then((data) => {
//         if (cancelled || !data?.stored || !Array.isArray(data.serviceCatalog)) return;
//         const normalized = data.serviceCatalog
//           .map(normalizeServiceCatalogEntry)
//           .filter(Boolean);
//         if (normalized.length) {
//           setServiceCatalogList(enrichServiceCatalogImages(normalized));
//         }
//       });
//       return () => {
//         cancelled = true;
//       };
//     }
//     const sync = () => setServiceCatalogList(loadServiceCatalogFromCalendarStorage());
//     window.addEventListener(CALENDAR_UPDATED_EVENT, sync);
//     const onStorage = (e) => {
//       if (e.key === CALENDAR_V1_STORAGE_KEY || e.key === null) sync();
//     };
//     window.addEventListener('storage', onStorage);
//     return () => {
//       window.removeEventListener(CALENDAR_UPDATED_EVENT, sync);
//       window.removeEventListener('storage', onStorage);
//     };
//   }, []);

//   useEffect(() => {
//     if (addServicesOpen) setServiceCatalogList(loadServiceCatalogFromCalendarStorage());
//   }, [addServicesOpen]);

//   // Per-appointment state (services / products / rates). Initialized from the
//   // appointment id passed via location.state — every appointment has its own
//   // unique queue. New (untracked) appointments start with an empty queue
//   // (Hourly + Consultation only, both at $0).
//   const initialApptState = useMemo(
//     () => getApptState(loadApptStateStore(), activeApt),
//     // We only read this once per apt id change. The effect below handles
//     // refreshing state when navigating between appointments.
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//     [],
//   );
//   const [hourlyRate, setHourlyRate] = useState(initialApptState.hourlyRate);
//   const [consultRate, setConsultRate] = useState(initialApptState.consultRate);
//   const [svcQueue, setSvcQueue] = useState(initialApptState.svcQueue);
//   const [productQueue, setProductQueue] = useState(initialApptState.productQueue);

//   /** Snapshot when hourly/consult rate sheet opens — used to detect a real edit on dismiss. */
//   const rateEditBaselineRef = useRef({ hourly: 0, consult: 0 });
//   const rateEditOpenKindRef = useRef(null);

//   // Reload per-appointment state whenever the active appointment id changes
//   // (e.g. user taps a different appointment in the Calendar without unmounting
//   // Screen2). Falls back to an empty queue for first-time appointments.
//   const apptKey = apptStateKey(activeApt);

//   useEffect(() => {
//     const rec = getApptState(loadApptStateStore(), activeApt);
//     setHourlyRate(rec.hourlyRate);
//     setConsultRate(rec.consultRate);
//     setSvcQueue(rec.svcQueue);
//     setProductQueue(rec.productQueue);
//     if (!isAppointmentsApiAvailable() || !apptKey) return undefined;
//     let cancelled = false;
//     void loadRemoteAppointmentVisit(apptKey).then((data) => {
//       if (cancelled || !data?.stored || !data.visit) return;
//       const remote = apptStateFromVisitPayload(data.visit);
//       if (!remote) return;
//       pauseRemoteVisitPersist();
//       const store = loadApptStateStore();
//       store[apptKey] = {
//         svcQueue: remote.svcQueue,
//         productQueue: remote.productQueue,
//         hourlyRate: remote.hourlyRate,
//         consultRate: remote.consultRate,
//         updatedAt: remote.updatedAt,
//       };
//       saveApptStateStore(store);
//       setHourlyRate(remote.hourlyRate);
//       setConsultRate(remote.consultRate);
//       setSvcQueue(remote.svcQueue);
//       setProductQueue(remote.productQueue);
//       window.setTimeout(() => resumeRemoteVisitPersist(), 400);
//     });
//     return () => {
//       cancelled = true;
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [apptKey]);

//   // Step-through progress (dots + visited rims). CHECK completes when the user
//   // lands on this screen with an appointment (e.g. tapped client card on S1).
//   const [s2Workflow, setS2Workflow] = useState(emptyS2Workflow);
//   useLayoutEffect(() => {
//     if (!apptKey) {
//       setS2Workflow(emptyS2Workflow());
//       return;
//     }
//     const saved = readScreen2WorkflowForApt(apptKey);
//     setS2Workflow({
//       check: true,
//       consult: !!saved?.consult,
//       services: !!saved?.services,
//       lift: !!saved?.lift,
//       booking: !!saved?.booking,
//     });
//   }, [apptKey]);

//   useEffect(() => {
//     if (!apptKey) return undefined;
//     const t = setTimeout(() => {
//       writeScreen2WorkflowForApt(apptKey, s2Workflow);
//     }, 120);
//     return () => clearTimeout(t);
//   }, [apptKey, s2Workflow]);

//   const markS2ConsultVisited = useCallback(() => {
//     setS2Workflow((w) => (w.consult ? w : { ...w, consult: true }));
//   }, []);

//   const markS2ServicesVisited = useCallback(() => {
//     setS2Workflow((w) => (w.services ? w : { ...w, services: true }));
//   }, []);
//   const markS2LiftVisited = useCallback(() => {
//     setS2Workflow((w) => (w.lift ? w : { ...w, lift: true }));
//   }, []);
//   const markS2BookingVisited = useCallback(() => {
//     setS2Workflow((w) => (w.booking ? w : { ...w, booking: true }));
//   }, []);
//   s2WorkflowMarkRef.current.consult = markS2ConsultVisited;

//   const dismissRateEdit = useCallback(() => {
//     if (rateEditOpen === 'hourly' && hourlyRate !== rateEditBaselineRef.current.hourly) {
//       markS2ServicesVisited();
//     } else if (rateEditOpen === 'consult' && consultRate !== rateEditBaselineRef.current.consult) {
//       markS2ServicesVisited();
//     }
//     setRateEditOpen(null);
//   }, [rateEditOpen, hourlyRate, consultRate, markS2ServicesVisited]);

//   const s2WorkflowNextIndex = useMemo(() => {
//     const ix = S2_WORKFLOW_STEPS.findIndex(([key]) => !s2Workflow[key]);
//     return ix < 0 ? -1 : ix;
//   }, [s2Workflow]);

//   // Persist on any change (debounced) — but only when we have a key to persist
//   // against. Visiting Screen2 without an appointment shouldn't pollute storage.
//   useEffect(() => {
//     if (!apptKey) return undefined;
//     const handle = setTimeout(() => {
//       const store = loadApptStateStore();
//       store[apptKey] = {
//         svcQueue,
//         productQueue,
//         hourlyRate,
//         consultRate,
//         updatedAt: Date.now(),
//       };
//       saveApptStateStore(store);
//       if (isAppointmentsApiAvailable()) {
//         void persistRemoteAppointmentVisit(
//           apptKey,
//           visitPayloadFromApptState({
//             svcQueue,
//             productQueue,
//             hourlyRate,
//             consultRate,
//           }),
//         ).catch(() => {
//           /* noop */
//         });
//       }
//     }, 250);
//     return () => clearTimeout(handle);
//   }, [apptKey, svcQueue, productQueue, hourlyRate, consultRate]);

//   const [removeConfirm, setRemoveConfirm] = useState(null);

//   // ---------- Live timer for the active appointment (or client fallback) ----------
//   // Shared TimersContext with Calendar chips + ClientList. Key is per-appointment
//   // when Screen2 was opened with an apt from Calendar (`apptKey`); otherwise client name.
//   const { timers, setTimer, clearTimer } = useTimers();
//   const timerKey = apptKey || activeClientName;
//   const persistedTimer = timers[timerKey] || null;

//   const [tickNow, setTickNow] = useState(() => Date.now());
//   useEffect(() => {
//     const isLive =
//       persistedTimer &&
//       (persistedTimer.kind === 'timerRunning' ||
//         persistedTimer.kind === 'stopwatchRunning');
//     if (!isLive) return undefined;
//     const id = setInterval(() => setTickNow(Date.now()), 250);
//     return () => clearInterval(id);
//   }, [persistedTimer]);

//   const liveTimer = useMemo(() => {
//     if (!persistedTimer) return null;
//     if (persistedTimer.kind === 'timerRunning') {
//       const remainingMs = persistedTimer.endsAt - tickNow;
//       if (remainingMs <= 0) return { kind: 'completed' };
//       return { kind: 'timerRunning', remainingMs };
//     }
//     if (persistedTimer.kind === 'stopwatchRunning') {
//       return { kind: 'stopwatchRunning', elapsedMs: tickNow - persistedTimer.startedAt };
//     }
//     return persistedTimer;
//   }, [persistedTimer, tickNow]);

//   // Promote expired countdowns to "completed" in the shared store so the
//   // Calendar appointment chip + Stylist card flip into the done state too.
//   useEffect(() => {
//     if (
//       liveTimer?.kind === 'completed' &&
//       timers[timerKey]?.kind === 'timerRunning'
//     ) {
//       setTimer(timerKey, { kind: 'completed' });
//     }
//   }, [liveTimer, timers, timerKey, setTimer]);

//   const [timerModalOpen, setTimerModalOpen] = useState(false);
//   const handleTimerStart = useCallback(
//     (totalSec) => {
//       if (!timerKey) return;
//       setTimer(timerKey, { kind: 'timerRunning', endsAt: Date.now() + totalSec * 1000 });
//       setTickNow(Date.now());
//       setTimerModalOpen(false);
//     },
//     [setTimer, timerKey],
//   );
//   const handleStopwatchStart = useCallback(() => {
//     if (!timerKey) return;
//     setTimer(timerKey, { kind: 'stopwatchRunning', startedAt: Date.now() });
//     setTickNow(Date.now());
//   }, [setTimer, timerKey]);
//   const handleTimerStop = useCallback(() => {
//     if (!timerKey) return;
//     clearTimer(timerKey);
//     setTimerModalOpen(false);
//   }, [clearTimer, timerKey]);
//   const handleTimerReset = useCallback(() => {
//     if (!timerKey) return;
//     clearTimer(timerKey);
//   }, [clearTimer, timerKey]);

//   const displaySvcQueue = useMemo(() => sortSvcQueueForDisplay(svcQueue), [svcQueue]);

//   const svcQuadPair = useMemo(
//     () => [displaySvcQueue[0] ?? null, displaySvcQueue[1] ?? null],
//     [displaySvcQueue],
//   );

//   const prdQuadPair = useMemo(() => [productQueue[0] ?? null, productQueue[1] ?? null], [productQueue]);

//   /** FINISH row (reference layout): up to 4 cards from queue, fill with catalog/defaults. */
//   const s2v2FinishProducts = useMemo(() => {
//     const out = (productQueue || []).slice(0, 4);
//     if (out.length >= 4) return out;
//     const seen = new Set(out.map((p) => p && p.id));
//     const fillers = [...(productCatalog || []), ...S2V2_FINISH_DEFAULT_PRODUCTS].filter(
//       (p) => p && !seen.has(p.id),
//     );
//     for (const filler of fillers) {
//       if (out.length >= 4) break;
//       out.push(filler);
//       seen.add(filler.id);
//     }
//     return out.slice(0, 4);
//   }, [productQueue, productCatalog]);

//   const hourlySvc = useMemo(
//     () => ({ ...SVC_HOURLY_BASE, price: hourlyRate, kind: 'hourly' }),
//     [hourlyRate],
//   );
//   const consultSvc = useMemo(
//     () => ({ ...SVC_CONSULT_BASE, price: consultRate, kind: 'consult' }),
//     [consultRate],
//   );
//   const svcPickerList = useMemo(() => {
//     const rest = serviceCatalogList.filter(
//       (s) => s.id !== 'SVC-HOURLY' && s.id !== 'SVC-CONSULT',
//     );
//     return [hourlySvc, consultSvc, ...rest];
//   }, [hourlySvc, consultSvc, serviceCatalogList]);

//   useEffect(() => {
//     setSvcQueue((prev) =>
//       prev.map((s) => {
//         if (s.id === 'SVC-HOURLY') return { ...s, price: hourlyRate };
//         if (s.id === 'SVC-CONSULT') return { ...s, price: consultRate };
//         return s;
//       }),
//     );
//   }, [hourlyRate, consultRate]);

//   useLayoutEffect(() => {
//     if (!rateEditOpen) {
//       rateEditOpenKindRef.current = null;
//       return;
//     }
//     if (rateEditOpen !== rateEditOpenKindRef.current) {
//       if (rateEditOpen === 'hourly') {
//         rateEditBaselineRef.current.hourly = hourlyRate;
//       } else if (rateEditOpen === 'consult') {
//         rateEditBaselineRef.current.consult = consultRate;
//       }
//       rateEditOpenKindRef.current = rateEditOpen;
//     }
//   }, [rateEditOpen, hourlyRate, consultRate]);

//   const openRemoveConfirm = useCallback((kind, id, label) => {
//     setRemoveConfirm({ kind, id, label });
//   }, []);

//   const handleConfirmRemove = useCallback(() => {
//     if (!removeConfirm) return;
//     if (removeConfirm.kind === 'svc') {
//       setSvcQueue((prev) => prev.filter((q) => q.id !== removeConfirm.id));
//       markS2ServicesVisited();
//     } else {
//       setProductQueue((prev) => prev.filter((q) => q.id !== removeConfirm.id));
//       markS2LiftVisited();
//     }
//     setRemoveConfirm(null);
//   }, [removeConfirm, markS2ServicesVisited, markS2LiftVisited]);

//   return (
//     <div className="s2-frame">
//     <div className="s2-root">
//       <div className="s2-bg" />

//       <div className="s2-topRightCurve" aria-hidden>
//         <svg
//           width="99"
//           height="216"
//           viewBox="0 0 99 216"
//           fill="none"
//           xmlns="http://www.w3.org/2000/svg"
//         >
//           <path
//             d="M25.2381 94.5C-5.77198 68 1.82035 1 1.82035 1H47.3204H97.8204V235.5L90.8169 190C80.6496 135 56.2482 121 25.2381 94.5Z"
//             fill="#1F1C1C"
//             stroke="var(--salonx-primary)"
//             strokeWidth="2"
//             vectorEffect="nonScalingStroke"
//           />
//         </svg>
//       </div>
//       {/* Today's date — mirrors Calendar's right-side stamp; sits over the top-right curve */}
//       <div className="s2-rightStamp" aria-hidden>
//         <div className="s2-rightStamp__dow">
//           {new Date().toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
//         </div>
//         <div className="s2-rightStamp__num">{new Date().getDate()}</div>
//       </div>

//       {/* TOP BAR */}
//       <div className="s2-topbar">






















        
//         <button
//           type="button"
//           className="s2-back"
//           onClick={() => navigate(backTarget)}
//           aria-label="Back"
//         >
//           <ArrowLeft size={22} weight="regular" aria-hidden />
//         </button>
//       </div>

//       {/* AVATAR + badges (left); name + phone optically centered on screen */}
//       <div className="s2-identity">
//         <div className="s2-identityMain">
//           <div className="s2-identityLeft">
//             <button
//               type="button"
//               className="s2-avatar"
//               onClick={openAvatarPhotoSheet}
//               aria-label={
//                 profilePhotoDisplayUrl ? 'Change profile photo' : 'Add profile photo'
//               }
//             >
//               {profilePhotoDisplayUrl ? (
//                 <img
//                   src={profilePhotoDisplayUrl}
//                   alt={`${activeClient.name} photo`}
//                   className="s2-avatar__img"
//                   draggable={false}
//                 />
//               ) : (
//                 <span className="s2-avatar__empty" aria-hidden>
//                   <Camera size={32} weight="regular" />
//                 </span>
//               )}
//             </button>
//             <input
//               ref={avatarCameraInputRef}
//               type="file"
//               accept="image/*"
//               capture="environment"
//               aria-hidden
//               tabIndex={-1}
//               style={{
//                 position: 'absolute',
//                 width: 1,
//                 height: 1,
//                 padding: 0,
//                 margin: -1,
//                 border: 0,
//                 clip: 'rect(0 0 0 0)',
//                 overflow: 'hidden',
//                 opacity: 0,
//                 pointerEvents: 'none',
//               }}
//               onChange={handleAvatarFileChosen}
//             />
//             <input
//               ref={avatarGalleryInputRef}
//               type="file"
//               accept="image/*"
//               aria-hidden
//               tabIndex={-1}
//               style={{
//                 position: 'absolute',
//                 width: 1,
//                 height: 1,
//                 padding: 0,
//                 margin: -1,
//                 border: 0,
//                 clip: 'rect(0 0 0 0)',
//                 overflow: 'hidden',
//                 opacity: 0,
//                 pointerEvents: 'none',
//               }}
//               onChange={handleAvatarFileChosen}
//             />
//             <div className="s2-msgBadges" aria-label="Unread messages">
//               <div className="s2-msgBadge" aria-hidden>
//                 💬<span className="s2-msgBadge__count">{META.msgCount}</span>
//           </div>
//         </div>
//           </div>
//           <div className="s2-identityCenter s2v2-identityCenter">
//             <div className="s2-identityText">
//               <div className="s2-clientName s2v2-clientName">{activeClient.name}</div>
//               <div className="s2-clientPhone s2v2-clientMeta">
//                 {activeClient.phone ? (
//                   <>
//                     <span className="s2v2-clientMeta__phone">{activeClient.phone}</span>
//                     <span className="s2v2-clientMeta__dot" aria-hidden>•</span>
//                   </>
//                 ) : null}
//                 <span className="s2v2-clientMeta__visit">
//                   {visitOrdinalLabel(consultRecord.LIFE_entries?.length || 0, isNewClient)}
//                 </span>
//               </div>
//             </div>
//           </div>
//           <div className="s2-identityRight s2v2-identityRight">
//             <button type="button" className="s2-kebabText s2v2-kebab" aria-label="More">
//               ⋮
//             </button>
//           </div>
//         </div>

//         <div className="s2-progress" aria-label="Progress">
//           <div className="s2-progressDots" aria-hidden>
//             {S2_WORKFLOW_STEPS.flatMap(([key], i) => {
//               const lit = s2Workflow[key];
//               const isCurrent = i === s2WorkflowNextIndex && s2WorkflowNextIndex >= 0;
//               const dot = (
//                 <span
//                   key={key}
//                   className={`s2-pdot${lit ? ' is-lit' : ''}${!lit && isCurrent ? ' is-current' : ''}`}
//                 />
//               );
//               if (i === 0) return [dot];
//               return [<span key={`s2-wf-line-${i}`} className="s2-dotLine" />, dot];
//             })}
//           </div>
//           <div className="s2-pdotLabels">
//             {S2_WORKFLOW_STEPS.map(([key, label], i) => {
//               const lit = s2Workflow[key];
//               const isCurrent = i === s2WorkflowNextIndex && s2WorkflowNextIndex >= 0;
//               return (
//                 <div
//                   key={key}
//                   className={`s2-pdotLabel${lit ? ' is-lit' : ''}${!lit && isCurrent ? ' is-current' : ''}`}
//                 >
//                   {label}
//                 </div>
//               );
//             })}
//           </div>
//         </div>
//       </div>

//       {/* MAIN CONTENT — v2 stack (reference image layout) */}
//       <div className="s2-body s2v2-body">
//         <section className="s2-section s2v2-section">
//           <div className="s2v2-sectionTitle">CONSULTATION</div>
//           <div
//             className={`s2v2-consultCard${s2Workflow.consult ? ' is-visited' : ''}`}
//           >
//             <div className="s2v2-consultMeta">
//               <span className="s2v2-consultMeta__left">
//                 {activeApptInfo
//                   ? `${activeApptInfo.dateShort}${
//                       activeApptInfo.durationLabel ? ` \u2022 ${activeApptInfo.durationLabel}` : ''
//                     }`
//                   : `${CONSULT.lastVisitShort} \u2022 ${CONSULT.duration}`}
//               </span>
//               <span className="s2v2-consultMeta__right">
//                 {activeApptInfo?.service?.trim() || 'Single Process Color'}
//                 {activeApptInfo?.durationLabel ? ` \u2022 ${activeApptInfo.durationLabel}` : ' \u2022 60 min'}
//               </span>
//             </div>

//             <div className="s2v2-consultRows">
//               {CONSULT.panes
//                 .filter((p) => p.key !== 'LOOK')
//                 .map((p) => {
//                   const text = (consultRecord[p.key] || '').trim() || p.text || '';
//                   return (
//                     <button
//                       key={p.key}
//                       type="button"
//                       className={`s2v2-consultRow ${p.colorClass}`}
//                       onClick={() => setConsultOpen(true)}
//                       aria-label={`Open ${p.key}`}
//                     >
//                       <span className="s2v2-consultRow__dot" aria-hidden />
//                       <span className="s2v2-consultRow__text">{text}</span>
//                       <ArrowRight size={20} weight="regular" className="s2v2-consultRow__caret" aria-hidden />
//                     </button>
//                   );
//                 })}
//             </div>
//           </div>
//         </section>

//         <section className="s2-section s2v2-section s2v2-section--create">
//           <div className="s2v2-sectionTitle">CREATE</div>
//           <div className="s2v2-createRow" aria-label="Services">
//             {S2V2_CREATE_CATEGORIES.map((cat) => (
//               <button
//                 key={cat}
//                 type="button"
//                 className="s2v2-catPill"
//                 onClick={() => setAddServicesOpen(true)}
//                 aria-label={`Add ${cat} service`}
//               >
//                 <span className="s2v2-catPill__label">{cat}</span>
//                 <Plus size={14} weight="bold" aria-hidden className="s2v2-catPill__plus" />
//               </button>
//             ))}
//             <button
//               type="button"
//               className="s2v2-catPill s2v2-catPill--add"
//               onClick={() => setAddServicesOpen(true)}
//               aria-label="Add service"
//             >
//               <Plus size={16} weight="bold" aria-hidden />
//               <span className="s2v2-catPill__label">ADD SERVICE</span>
//             </button>
//           </div>
//           <div className="s2v2-suggestedLine">
//             <span className="s2v2-suggestedLine__lead">Suggested:</span>
//             <span className="s2v2-suggestedLine__items">
//               {S2V2_CREATE_SUGGESTED.map((item, i) => (
//                 <React.Fragment key={item}>
//                   {i > 0 ? <span className="s2v2-suggestedLine__dot" aria-hidden>•</span> : null}
//                   <button
//                     type="button"
//                     className="s2v2-suggestedLine__chip"
//                     onClick={() => setAddServicesOpen(true)}
//                   >
//                     {item}
//                   </button>
//                 </React.Fragment>
//               ))}
//             </span>
//           </div>
//         </section>

//         <section className="s2-section s2v2-section s2v2-section--finish">
//           <div className="s2v2-sectionTitle">FINISH</div>
//           <div className="s2v2-productRow" aria-label="Back bar products">
//             {s2v2FinishProducts.map((p, i) => (
//               <button
//                 key={p.id || `s2v2-finish-${i}`}
//                 type="button"
//                 className="s2v2-productCard"
//                 onClick={() => setAddProductsOpen(true)}
//                 aria-label={`${p.brand} ${p.name}`}
//               >
//                 <div className="s2v2-productCard__photo">
//                   {productImageUrl(p) ? (
//                     <img
//                       src={productImageUrl(p)}
//                       alt=""
//                       loading="lazy"
//                       decoding="async"
//                       referrerPolicy="no-referrer"
//                       onError={(e) => {
//                         e.currentTarget.remove();
//                       }}
//                     />
//                   ) : null}
//                 </div>
//                 <div className="s2v2-productCard__brand">{p.brand}</div>
//                 <div className="s2v2-productCard__name">{p.name}</div>
//               </button>
//             ))}
//             <button
//               type="button"
//               className="s2v2-productCard s2v2-productCard--add"
//               onClick={() => setAddProductsOpen(true)}
//               aria-label="Add product"
//             >
//               <span className="s2v2-productCard__addIcon" aria-hidden>
//                 <Plus size={28} weight="regular" />
//               </span>
//               <span className="s2v2-productCard__addLabel">ADD<br />PRODUCT</span>
//             </button>
//           </div>
//           <div className="s2v2-suggestedLine">
//             <span className="s2v2-suggestedLine__lead">Suggested:</span>
//             <span className="s2v2-suggestedLine__items">
//               {S2V2_FINISH_SUGGESTED.map((item, i) => (
//                 <React.Fragment key={item}>
//                   {i > 0 ? <span className="s2v2-suggestedLine__dot" aria-hidden>•</span> : null}
//                   <button
//                     type="button"
//                     className="s2v2-suggestedLine__chip"
//                     onClick={() => setAddProductsOpen(true)}
//                   >
//                     {item}
//                   </button>
//                 </React.Fragment>
//               ))}
//             </span>
//           </div>
//         </section>

//         <div className="s2-bottomDock s2-bottomDock--inline">
//           <div className="s2-bottomDock__content">
//             <div className="s2-ctaRow">
//               <button type="button" className="s2-cta is-rebook" onClick={markS2BookingVisited}>
//                 <div className="s2-ctaIcon" aria-hidden>↻</div>
//                 <div className="s2-ctaLabel">Rebook</div>
//         </button>
//               <button
//                 type="button"
//                 className="s2-cta is-checkout"
//                 onClick={() => {
//                   markS2BookingVisited();
//                   writePersistedScreen2Apt(activeApt, '/screen2');
//                   navigate('/climax', { state: { apt: activeApt, from: '/screen2' } });
//                 }}
//               >
//                 <div className="s2-ctaIcon" aria-hidden><span className="s2-flagIcon" /></div>
//                 <div className="s2-ctaLabel">Check out</div>
//         </button>
//       </div>
//       <div className="s2-toolbar">
//               {TOOLBAR_ITEMS.map(({ Icon, label, to }, i) => {
//                 const isActive = i === TOOLBAR_ACTIVE;
//                 return (
//           <button
//             key={label}
//             type="button"
//                     className={`s2-toolbar__btn${isActive ? ' s2-toolbar__btn--solid' : ''}`}
//             aria-label={label}
//                     aria-current={isActive ? 'page' : undefined}
//             onClick={() => {
//                       if (to === '/clients') {
//                         navigate(to, { state: { from: '/screen2' } });
//                         return;
//                       }
//                       navigate(
//                         to,
//                         activeApt
//                           ? {
//                               state: {
//                                 apt: activeApt,
//                                 ...(to === '/climax' ? { from: '/screen2' } : {}),
//                               },
//                             }
//                           : undefined,
//                       );
//             }}
//           >
//             <Icon
//                       size={isActive ? S2_ICON_TOOLBAR_ACTIVE : S2_ICON_TOOLBAR}
//                       weight={isActive ? 'fill' : 'regular'}
//               aria-hidden
//             />
//           </button>
//                 );
//               })}
//             </div>
//           </div>
//         </div>
//       </div>

//       {consultOpen ? (
//         <>
//           <ConsultationBriefPopup
//             clientName={activeClient.name}
//             clientPhotoUrl={profilePhotoDisplayUrl}
//             visitLabel={visitOrdinalLabel(consultRecord.LIFE_entries?.length || 0, isNewClient)}
//             msgCount={META.msgCount}
//             consultRecord={consultRecord}
//             liveTimer={liveTimer}
//             prePillKind={prePillKind}
//             preSummary={preSummary}
//             returningSuffix={returningSuffix}
//             photosChron={photosChron}
//             formatNoteDateShort={formatNoteDateShort}
//             onClose={closeConsultBrief}
//             onOpenNewNote={openNewNote}
//             onOpenNewNoteWithVoice={openNewNoteWithVoice}
//             onOpenPhotoPicker={openPhotoPicker}
//             onEditPaneEntry={onEditPaneEntry}
//             onEditPhotoEntry={onEditPhotoEntry}
//             onSetTimerModalOpen={setTimerModalOpen}
//           />
//           <input
//             ref={photoInputRef}
//             type="file"
//             accept="image/*"
//             capture="environment"
//               aria-hidden
//             tabIndex={-1}
//             style={{
//               position: 'absolute',
//               width: 1,
//               height: 1,
//               padding: 0,
//               margin: -1,
//               border: 0,
//               clip: 'rect(0 0 0 0)',
//               overflow: 'hidden',
//               opacity: 0,
//               pointerEvents: 'none',
//             }}
//             onChange={handlePhotoChosen}
//           />
//           <input
//             ref={photoGalleryInputRef}
//             type="file"
//             accept="image/*"
//             aria-hidden
//             tabIndex={-1}
//             style={{
//               position: 'absolute',
//               width: 1,
//               height: 1,
//               padding: 0,
//               margin: -1,
//               border: 0,
//               clip: 'rect(0 0 0 0)',
//               overflow: 'hidden',
//               opacity: 0,
//               pointerEvents: 'none',
//             }}
//             onChange={handlePhotoChosen}
//           />
//         </>
//       ) : null}

//       {lookPhotoSheetOpen ? (
//         <div
//           className="s2-avatarPhotoOverlay"
//           role="dialog"
//           aria-modal="true"
//           aria-label="Add LOOK photo"
//         >
//           <button
//             type="button"
//             className="s2-addProdBackdrop"
//             aria-label="Close"
//             onClick={() => setLookPhotoSheetOpen(false)}
//           />
//           <div className="s2-avatarPhotoSheet">
//             <h2 className="s2-avatarPhotoTitle">Add a photo</h2>
//             <div className="s2-avatarPhotoActions">
//               <button
//                 type="button"
//                 className="s2-avatarPhotoBtn"
//                 onClick={triggerLookCamera}
//               >
//                 <Camera size={22} weight="regular" aria-hidden />
//                 <span>Take a photo</span>
//               </button>
//               <button
//                 type="button"
//                 className="s2-avatarPhotoBtn"
//                 onClick={triggerLookGallery}
//               >
//                 <ImageIcon size={22} weight="regular" aria-hidden />
//                 <span>Choose from camera roll</span>
//               </button>
//             </div>
//             <button
//               type="button"
//               className="s2-avatarPhotoCancel"
//               onClick={() => setLookPhotoSheetOpen(false)}
//             >
//               Cancel
//             </button>
//           </div>
//         </div>
//       ) : null}

//       {/* Note composer — absolute inside .s2-root; data-salonx-keyboard-lock ties into main.jsx visualViewport lock. */}
//       {noteEditOpen ? (
//         <div
//           className="s2-noteOverlay"
//           data-salonx-keyboard-lock=""
//           role="dialog"
//           aria-modal="true"
//           aria-label={`${noteEditOpen.mode === 'edit' ? 'Update' : 'New'} ${noteEditOpen.pane} note`}
//         >
//           <button
//             type="button"
//             className="s2-noteBackdrop"
//             aria-label="Cancel"
//             onClick={cancelNoteDraft}
//           />
//           <div className="s2-noteSheet" role="document">
//             <header className="s2-noteHeader">
//               <div
//                 className={`s2-noteLabel ${
//                   noteEditOpen.pane === 'LIFE'
//                     ? 'is-pink'
//                     : noteEditOpen.pane === 'CHAIR'
//                       ? 'is-yellow'
//                       : 'is-green'
//                 }`}
//               >
//                 {noteEditOpen.pane}
//               </div>
//               <div className="s2-noteTitle">
//                 {noteEditOpen.mode === 'edit' ? 'Update note' : 'New note'}
//               </div>
//               <button
//                 type="button"
//                 className="s2-noteClose"
//                 aria-label="Cancel"
//                 onClick={cancelNoteDraft}
//               >
//                 <X size={18} weight="regular" aria-hidden />
//               </button>
//             </header>

//             <div className="s2-noteBody">
//               <textarea
//                 className="s2-noteInput"
//                 value={noteDraft}
//                 onChange={(e) => setNoteDraft(e.target.value)}
//                 placeholder={
//                   noteEditOpen.mode === 'edit'
//                     ? `Edit this ${noteEditOpen.pane.toLowerCase()} note…`
//                     : `Tap mic to dictate, or type a new ${noteEditOpen.pane.toLowerCase()} note…`
//                 }
//                 autoFocus
//                 spellCheck={false}
//               />
//               <button
//                 type="button"
//                 className={`s2-noteMic${recordingPane === noteEditOpen.pane ? ' is-recording' : ''}`}
//                 aria-label={recordingPane === noteEditOpen.pane ? 'Stop dictation' : 'Start dictation'}
//                 aria-pressed={recordingPane === noteEditOpen.pane}
//                 onClick={() => toggleVoice(noteEditOpen.pane)}
//               >
//                 <Microphone size={18} weight="fill" aria-hidden />
//         </button>
//             </div>

//             <footer className="s2-noteFooter">
//               <button
//                 type="button"
//                 className="s2-noteUpdate"
//                 disabled={!noteDraft.trim()}
//                 onClick={(e) => {
//                   e.preventDefault();
//                   e.stopPropagation();
//                   submitNoteDraft();
//                 }}
//               >
//                 Update
//         </button>
//             </footer>
//       </div>
//         </div>
//       ) : null}

//       {addServicesOpen ? (
//         <div className="s2-addProdOverlay" role="dialog" aria-modal="true" aria-label="Add services">
//           <button
//             type="button"
//             className="s2-addProdBackdrop"
//             aria-label="Close"
//             onClick={() => setAddServicesOpen(false)}
//           />
//           <div className="s2-addProdSheet">
//             <header className="s2-addProdHeader">
//               <button
//                 type="button"
//                 className="s2-addProdClose"
//                 onClick={() => setAddServicesOpen(false)}
//                 aria-label="Close"
//               >
//                 <X size={18} weight="regular" aria-hidden />
//               </button>
//               <div className="s2-svcPickBrand" aria-hidden>
//                 <Butterfly className="s2-svcPickButterfly" size={26} weight="fill" />
//                 <div className="s2-svcPickSalon">THE BUTTERFLY LOFT</div>
//                 <div className="s2-svcPickPowered">POWERED BY DANGER JONES</div>
//               </div>
//             </header>
//             <div className="s2-addProdScroll">
//               <div className="s2-addProdGrid">
//                 {svcPickerList.map((s, i) => {
//                   const inQueue = svcQueue.some((q) => q.id === s.id);
//                   const rowSvc =
//                     s.id === 'SVC-HOURLY' ? hourlySvc : s.id === 'SVC-CONSULT' ? consultSvc : s;
//                 return (
//                   <button
//                       key={s.id}
//                       type="button"
//                       className={`s2-addProdCard s2-addProdCard--service${inQueue ? ' is-inQueue' : ''}`}
//             onClick={() => {
//                         setSvcQueue((prev) =>
//                           prev.some((q) => q.id === s.id)
//                             ? prev.filter((q) => q.id !== s.id)
//                             : [...prev, rowSvc],
//                         );
//                         markS2ServicesVisited();
//                       }}
//                     >
//                       <S2ProductPhoto
//                         imageUrl={serviceImageUrl(rowSvc)}
//                         fallbackBackground={svcGradientForIndex(i)}
//                         wrapClassName="s2-addProdCard__visual"
//                         imgClassName="s2-addProdCard__photo"
//                         decorative
//                       />
//                       <div className="s2-addProdCard__meta">
//                         <div className="s2-addProdCard__name s2-addProdCard__name--service">{rowSvc.name}</div>
//                         <div className="s2-addProdCard__price">{queuePriceLabel(rowSvc)}</div>
//                       </div>
//           </button>
//                 );
//               })}
//             </div>
//           </div>
//             <footer className="s2-svcPickQueue">
//               <div className="s2-svcPickQueue__label">S2 QUEUE</div>
//               <div className="s2-svcPickQueue__row">
//                 {displaySvcQueue.map((s, qi) => (
//                   <div key={`${s.id}-${qi}`} className="s2-svcPickQueueCard">
//                     <button
//                       type="button"
//                       className="s2-svcPickQueueCard__rm"
//                       aria-label={`Remove ${s.name}`}
//                       onClick={() => openRemoveConfirm('svc', s.id, s.name)}
//                     >
//                       <X size={10} weight="bold" aria-hidden />
//                     </button>
//                     <S2ProductPhoto
//                       imageUrl={serviceImageUrlResolved(s, svcPickerList)}
//                       fallbackBackground={svcGradientForPickerId(s.id, svcPickerList)}
//                       wrapClassName="s2-svcPickQueueCard__thumb"
//                       imgClassName="s2-svcPickQueueCard__photo"
//                       decorative
//                     />
//                     <div className="s2-svcPickQueueCard__meta">
//                       <div className="s2-svcPickQueueCard__name">{s.name}</div>
//                       <div className="s2-svcPickQueueCard__price">{queuePriceLabel(s)}</div>
//         </div>
//             </div>
//                 ))}
//                 <button
//                   type="button"
//                   className="s2-svcPickQueueAdd"
//                   onClick={() => {
//                     setSvcQueue((prev) => [
//                       ...prev,
//                       { id: `SVC-C-${Date.now()}`, name: 'Custom service', price: 0 },
//                     ]);
//                     markS2ServicesVisited();
//                   }}
//                 >
//                   <span className="s2-svcPickQueueAdd__plus" aria-hidden>
//                     +
//                         </span>
//                   <span className="s2-svcPickQueueAdd__text">ADD CUSTOM SERVICE</span>
//             </button>
//                     </div>
//             </footer>
//           </div>
//         </div>
//       ) : null}

//       {addProductsOpen ? (
//         <div className="s2-addProdOverlay" role="dialog" aria-modal="true" aria-label="Add products">
//           <button
//             type="button"
//             className="s2-addProdBackdrop"
//             aria-label="Close"
//             onClick={() => setAddProductsOpen(false)}
//           />
//           <div className="s2-addProdSheet">
//             <header className="s2-addProdHeader">
//               <button
//                 type="button"
//                 className="s2-addProdClose"
//                 onClick={() => setAddProductsOpen(false)}
//                 aria-label="Close"
//               >
//                 <X size={18} weight="regular" aria-hidden />
//             </button>
//               <div className="s2-addProdKicker">{ADD_PRODUCTS_BRAND}</div>
//               <h2 className="s2-addProdTitle">ADD PRODUCTS</h2>
//             </header>
//             <div className="s2-addProdScroll">
//               <div className="s2-addProdGrid">
//                 {productCatalog.map((p) => {
//                   const inQueue = productQueue.some((q) => q.id === p.id);
//                 return (
//                   <button
//                       key={p.id}
//                       type="button"
//                       className={`s2-addProdCard${inQueue ? ' is-inQueue' : ''}`}
//                       onClick={() => {
//                         setProductQueue((prev) =>
//                           prev.some((q) => q.id === p.id)
//                             ? prev.filter((q) => q.id !== p.id)
//                             : [...prev, p],
//                         );
//                         markS2LiftVisited();
//                       }}
//                     >
//                       <S2ProductPhoto
//                         imageUrl={productImageUrl(p)}
//                         fallbackBackground={productVisualGradient(p.color)}
//                         wrapClassName="s2-addProdCard__visual"
//                         imgClassName="s2-addProdCard__photo"
//                         decorative
//                       />
//                       <div className="s2-addProdCard__meta">
//                         <div className="s2-addProdCard__brand">{p.brand}</div>
//                         <div className="s2-addProdCard__name">{p.name}</div>
//                         <div className="s2-addProdCard__price">${p.price}</div>
//                     </div>
//                   </button>
//                 );
//               })}
//             </div>
//           </div>
//             <footer className="s2-svcPickQueue s2-prodPickQueue">
//               <div className="s2-svcPickQueue__label">FINISH</div>
//               <div className="s2-svcPickQueue__row">
//                 {productQueue.map((p, qi) => (
//                   <div key={`${p.id}-${qi}`} className="s2-svcPickQueueCard">
//                     <button
//                       type="button"
//                       className="s2-svcPickQueueCard__rm"
//                       aria-label={`Remove ${p.name}`}
//                       onClick={() => openRemoveConfirm('product', p.id, `${p.brand} · ${p.name}`)}
//                     >
//                       <X size={10} weight="bold" aria-hidden />
//                     </button>
//                     <S2ProductPhoto
//                       imageUrl={productImageUrl(p)}
//                       fallbackBackground={productVisualGradient(p.color)}
//                       wrapClassName="s2-svcPickQueueCard__thumb"
//                       imgClassName="s2-svcPickQueueCard__photo"
//                       decorative
//                     />
//                     <div className="s2-svcPickQueueCard__meta">
//                       <div className="s2-svcPickQueueCard__brand">{p.brand}</div>
//                       <div className="s2-svcPickQueueCard__name">{p.name}</div>
//                       <div className="s2-svcPickQueueCard__price">${p.price}</div>
//         </div>
//             </div>
//                 ))}
//               </div>
//             </footer>
//           </div>
//         </div>
//       ) : null}

//       {removeConfirm ? (
//         <div className="s2-confirmOverlay" role="dialog" aria-modal="true" aria-labelledby="s2-remove-confirm-title">
//           <button
//             type="button"
//             className="s2-addProdBackdrop"
//             aria-label="Cancel"
//             onClick={() => setRemoveConfirm(null)}
//           />
//           <div className="s2-confirmSheet">
//             <h2 id="s2-remove-confirm-title" className="s2-confirmTitle">
//               Remove this item?
//             </h2>
//             <p className="s2-confirmBody">{removeConfirm.label}</p>
//             <div className="s2-confirmActions">
//               <button type="button" className="s2-confirmBtn s2-confirmBtn--ghost" onClick={() => setRemoveConfirm(null)}>
//                 Cancel
//               </button>
//               <button type="button" className="s2-confirmBtn s2-confirmBtn--danger" onClick={handleConfirmRemove}>
//                 Yes, remove
//             </button>
//           </div>
//           </div>
//         </div>
//       ) : null}

//       {avatarPhotoSheetOpen ? (
//         <div
//           className="s2-avatarPhotoOverlay"
//           role="dialog"
//           aria-modal="true"
//           aria-label="Profile photo"
//         >
//                   <button
//             type="button"
//             className="s2-addProdBackdrop"
//             aria-label="Close"
//             onClick={() => setAvatarPhotoSheetOpen(false)}
//           />
//           <div className="s2-avatarPhotoSheet">
//             <h2 className="s2-avatarPhotoTitle">
//               {profilePhotoDisplayUrl ? 'Change profile photo' : 'Add profile photo'}
//             </h2>
//             <div className="s2-avatarPhotoActions">
//               <button
//                 type="button"
//                 className="s2-avatarPhotoBtn"
//                 onClick={triggerAvatarCamera}
//               >
//                 <Camera size={22} weight="regular" aria-hidden />
//                 <span>Take a photo</span>
//               </button>
//               <button
//                 type="button"
//                 className="s2-avatarPhotoBtn"
//                 onClick={triggerAvatarGallery}
//               >
//                 <ImageIcon size={22} weight="regular" aria-hidden />
//                 <span>
//                   {profilePhotoDisplayUrl ? 'Choose a new photo' : 'Choose from library'}
//                         </span>
//               </button>
//                     </div>
//             <button
//               type="button"
//               className="s2-avatarPhotoCancel"
//               onClick={() => setAvatarPhotoSheetOpen(false)}
//             >
//               Cancel
//                   </button>
//           </div>
//         </div>
//       ) : null}

//       {rateEditOpen ? (
//         <div className="s2-rateEditOverlay" role="dialog" aria-modal="true" aria-label={rateEditOpen === 'hourly' ? 'Hourly rate' : 'Consultation fee'}>
//           <button
//             type="button"
//             className="s2-addProdBackdrop"
//             aria-label="Close"
//             onClick={dismissRateEdit}
//           />
//           <div className="s2-rateEditSheet">
//             <header className="s2-rateEditHeader">
//               <button type="button" className="s2-rateEditClose" aria-label="Close" onClick={dismissRateEdit}>
//                 <X size={18} weight="regular" aria-hidden />
//               </button>
//               <h2 className="s2-rateEditTitle">{rateEditOpen === 'hourly' ? 'Hourly rate' : 'Consultation fee'}</h2>
//               <p className="s2-rateEditHint">
//                 {rateEditOpen === 'hourly'
//                   ? `$${ADJ_RATE_MIN}–$${ADJ_RATE_MAX} per hour · $1 steps`
//                   : `$${ADJ_RATE_MIN}–$${ADJ_RATE_MAX} consultation fee · $1 steps`}
//               </p>
//             </header>
//             {rateEditOpen === 'hourly' || rateEditOpen === 'consult' ? (
//               <div className="s2-rateEditBody">
//                 {(() => {
//                   const isHourly = rateEditOpen === 'hourly';
//                   const rateVal = isHourly ? hourlyRate : consultRate;
//                   const setRateVal = isHourly ? setHourlyRate : setConsultRate;
//                   const fillPct =
//                     ADJ_RATE_MAX > ADJ_RATE_MIN
//                       ? ((rateVal - ADJ_RATE_MIN) / (ADJ_RATE_MAX - ADJ_RATE_MIN)) * 100
//                       : 0;
//                   return (
//                     <>
//                       <div className="s2-rateEditBig">
//                         ${rateVal}
//                         {isHourly ? <span className="s2-rateEditBig__suffix">/hr</span> : null}
//                       </div>
//                       <input
//                         type="range"
//                         className="s2-rateEditSlider"
//                         min={ADJ_RATE_MIN}
//                         max={ADJ_RATE_MAX}
//                         step={1}
//                         value={rateVal}
//                         aria-valuemin={ADJ_RATE_MIN}
//                         aria-valuemax={ADJ_RATE_MAX}
//                         aria-valuenow={rateVal}
//                         style={{ '--rate-fill': `${fillPct}%` }}
//                         onChange={(e) => setRateVal(clampAdjustableRate(e.target.value))}
//                       />
//                       <label className="s2-rateEditField">
//                         <span className="s2-rateEditField__label">{isHourly ? '$ / hour' : '$ consultation'}</span>
//                         <input
//                           type="number"
//                           inputMode="numeric"
//                           className="s2-rateEditInput"
//                           min={ADJ_RATE_MIN}
//                           max={ADJ_RATE_MAX}
//                           step={1}
//                           value={rateVal}
//                           onChange={(e) => setRateVal(clampAdjustableRate(e.target.value))}
//                         />
//                       </label>
//                       <button type="button" className="s2-rateEditDone" onClick={dismissRateEdit}>
//                         Done
//                       </button>
//                     </>
//                   );
//                 })()}
//             </div>
//             ) : null}
//           </div>
//         </div>
//       ) : null}

//       <TimerModal
//         open={timerModalOpen}
//         clientName={activeClientName}
//         runningState={liveTimer}
//         placement="center"
//         onClose={() => setTimerModalOpen(false)}
//         onStartTimer={handleTimerStart}
//         onStartStopwatch={handleStopwatchStart}
//         onStopStopwatch={handleTimerStop}
//         onStopTimer={handleTimerStop}
//         onResetTimer={handleTimerReset}
//       />
//     </div>
//     </div>
//   );
// }
