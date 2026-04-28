import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { MOCK_PRODUCTS } from '../../data/mockProducts';
import { MOCK_SERVICES } from '../../data/mockServices';
import './s2.css';

const S2_ICON_TOOLBAR = 24;
const S2_ICON_TOOLBAR_ACTIVE = 26;

const TOOLBAR_ACTIVE = 1;
const TOOLBAR_ITEMS = [
  { Icon: Scissors, label: 'Stylist', to: '/screen1' },
  { Icon: User, label: 'Client details', to: '/screen2' },
  { Icon: Lightning, label: 'Checkout', to: '/checkout' },
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

const SVC_PICK_INITIAL_REST_IDS = ['SVC-014', 'SVC-015', 'SVC-019', 'SVC-027'];

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

export default function Screen2() {
  const navigate = useNavigate();
  const [consultOpen, setConsultOpen] = useState(false);
  const [addServicesOpen, setAddServicesOpen] = useState(false);
  const [addProductsOpen, setAddProductsOpen] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [consultRate, setConsultRate] = useState(0);
  const [rateEditOpen, setRateEditOpen] = useState(null);
  const [svcQueue, setSvcQueue] = useState(() => {
    const rest = SVC_PICK_INITIAL_REST_IDS.map((id) => MOCK_SERVICES.find((x) => x.id === id)).filter(Boolean);
    return [
      { ...SVC_HOURLY_BASE, price: 0, kind: 'hourly' },
      { ...SVC_CONSULT_BASE, price: 0, kind: 'consult' },
      ...rest,
    ];
  });
  const [productQueue, setProductQueue] = useState([]);
  const [dockOpen, setDockOpen] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(null);

  const grabberTouch = useRef({ y: 0 });
  const navTouch = useRef({ x: 0, y: 0, skipFilmNav: false });

  const initials = useMemo(() => CLIENT.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(), []);

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
        <div className="s2-avatar">{initials}</div>

        <div className="s2-identityRow">
          <div className="s2-msgBadges" aria-label="Unread messages">
            <div className="s2-msgBadge" aria-hidden>
              💬<span className="s2-msgBadge__count">{META.msgCount}</span>
            </div>
          </div>
          <div className="s2-clientName">{CLIENT.name}</div>
          <div className="s2-clientPhone">{CLIENT.phone}</div>
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
              <div className="s2-consultHeader__left">Last visit · {CONSULT.lastVisitShort} · {CONSULT.duration}</div>
              <div className="s2-consultHeader__right">{CONSULT.noteTag} · {CONSULT.noteHint} note</div>
            </div>

            <div className="s2-consultScroll">
              {CONSULT.panes.map((p) => (
                <div key={p.key} className="s2-pane">
                  <div className={`s2-paneLabel ${p.colorClass}`}>{p.key}</div>
                  {p.key !== 'LOOK' ? (
                    <div className="s2-paneContent">{p.text}</div>
                  ) : (
                    <div className="s2-paneContent s2-lookStrip">
                      {CONSULT.lookThumbs.map((t) => (
                        <div key={t.label} className={`s2-lookThumb is-${t.tone}`}>
                          <div className="s2-lookThumb__tag">{t.label}</div>
                        </div>
                      ))}
                      <div className="s2-lookMore">+{CONSULT.lookExtraCount}</div>
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
            <button type="button" className="s2-cta is-checkout" onClick={() => navigate('/checkout')}>
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
          <button type="button" className="s2-popupBackdrop" aria-label="Close" onClick={() => setConsultOpen(false)} />
          <div className="s2-popup">
            <div className="s2-popupTopbar">
              <button type="button" className="s2-popupClose" aria-label="Close" onClick={() => setConsultOpen(false)}>×</button>
              <div className="s2-popupTitle">{CLIENT.name.toUpperCase()}</div>
              <div className="s2-popupSpacer" aria-hidden />
            </div>

            <div className="s2-popupBody">
              {CONSULT.panes.map((p) => (
                <div key={p.key} className="s2-popPane">
                  <div className="s2-popPaneHeader">
                    <div className={`s2-popPaneLabel ${p.colorClass}`}>{p.key}</div>
                    {p.key === 'LOOK' ? (
                      <button type="button" className="s2-popCam is-look" aria-label="Capture photo">
                        <Camera size={16} weight="fill" aria-hidden />
                      </button>
                    ) : (
                      <button type="button" className={`s2-popMic ${p.colorClass}`} aria-label={`Record to ${p.key}`}>
                        <Microphone size={16} weight="fill" aria-hidden />
                      </button>
                    )}
                  </div>

                  {p.key !== 'LOOK' ? (
                    <div className="s2-popPaneContent">{p.text}</div>
                  ) : (
                    <div className="s2-popLook">
                      <div className="s2-popLookGrid">
                        <div className="s2-popLookCell is-now" />
                        <div className="s2-popLookCell is-want" />
                        <div className="s2-popLookCell is-last" />
                        <div className="s2-popLookCell is-add">+ ADD</div>
                        <div className="s2-popLookCell is-add">+ ADD</div>
                        <div className="s2-popLookCell is-add">+ ADD</div>
                      </div>
                      <div className="s2-popLookTags">
                        <div className="s2-popLookTag">NOW</div>
                        <div className="s2-popLookTag">WANT</div>
                        <div className="s2-popLookTag">LAST</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
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
