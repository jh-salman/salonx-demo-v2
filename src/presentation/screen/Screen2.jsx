import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Butterfly,
  CalendarBlank,
  Camera,
  Lightning,
  Microphone,
  Scissors,
  User,
  X,
} from 'phosphor-react';
import { MOCK_PRODUCTS } from '../../data/mockProducts';
import { MOCK_SERVICES } from '../../data/mockServices';
import './s2.css';

const S2_ICON_TOOLBAR = 24;
const S2_ICON_TOOLBAR_ACTIVE = 26;

const TOOLBAR_ITEMS = [
  { Icon: Scissors, label: 'Styling / tools' },
  { Icon: User, label: 'Client' },
  { Icon: Lightning, label: 'Session' },
  { Icon: CalendarBlank, label: 'Calendar' },
  { Icon: X, label: 'Close' },
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

const SVC_PICK_INITIAL_QUEUE_IDS = ['SVC-014', 'SVC-015', 'SVC-019', 'SVC-027'];

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

function queuePriceLabel(s) {
  if (String(s.id).startsWith('SVC-C')) return '$100/hr';
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
  const [svcQueue, setSvcQueue] = useState(() =>
    SVC_PICK_INITIAL_QUEUE_IDS.map((id) => MOCK_SERVICES.find((x) => x.id === id)).filter(Boolean),
  );
  const [productQueue, setProductQueue] = useState([]);
  const [dockOpen, setDockOpen] = useState(false);

  const grabberTouch = useRef({ y: 0 });
  const navTouch = useRef({ x: 0, y: 0, skipFilmNav: false });

  const initials = useMemo(() => CLIENT.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(), []);

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
    if (consultOpen || addServicesOpen || addProductsOpen) return;
    const t = e.touches[0];
    const el = e.target;
    const skipFilmNav =
      el &&
      typeof el.closest === 'function' &&
      Boolean(el.closest('.s2-filmCluster--left'));
    navTouch.current = { x: t.clientX, y: t.clientY, skipFilmNav };
  }, [addProductsOpen, addServicesOpen, consultOpen]);

  const onRootTouchEnd = useCallback((e) => {
    if (consultOpen || addServicesOpen || addProductsOpen) return;
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
  }, [addProductsOpen, addServicesOpen, consultOpen, navigate]);

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
              <div className="s2-filmCluster s2-filmCluster--left">
                {svcQueue.map((s, i) => (
                  <div
                    key={`${s.id}-row-${i}`}
                    className="s2-filmPill s2-filmPill--svc"
                    title={s.name}
                  >
                    <span className="s2-filmPill__mono">{queuePriceLabel(s)}</span>
                  </div>
                ))}
                <button
                  type="button"
                  className="s2-filmPlus s2-filmPlus--inline"
                  aria-label="Add services"
                  onClick={() => setAddServicesOpen(true)}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="s2-section">
          <div className="s2-pill s2-pill--neutral">Home Care</div>
          <div className="s2-card s2-card--v13 s2-hcCard">
            <div className="s2-filmRow s2-filmRow--products" aria-label="Home care products">
              <div className="s2-filmCluster s2-filmCluster--left">
                {productQueue.map((p, i) => (
                  <div
                    key={`${p.id}-row-${i}`}
                    className="s2-filmPill s2-filmPill--prd"
                    title={p.name}
                  >
                    <span className="s2-filmPill__brand">{p.brand}</span>
                    <span className="s2-filmPill__mono">${p.price}</span>
                  </div>
                ))}
                <button
                  type="button"
                  className="s2-filmPlus s2-filmPlus--inline"
                  aria-label="Add products"
                  onClick={() => setAddProductsOpen(true)}
                >
                  +
                </button>
              </div>
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
            {TOOLBAR_ITEMS.map(({ Icon, label }, i) => (
              <button
                key={label}
                type="button"
                className={`s2-toolbar__btn${i === 2 ? ' s2-toolbar__btn--solid' : ''}`}
                aria-label={label}
                onClick={() => {
                  if (i === 1) navigate('/screen1');
                  if (i === 3) navigate('/calendar');
                  if (i === 4) navigate('/');
                }}
              >
                <Icon
                  size={i === 2 ? S2_ICON_TOOLBAR_ACTIVE : S2_ICON_TOOLBAR}
                  weight={i === 2 ? 'fill' : 'regular'}
                  aria-hidden
                />
              </button>
            ))}
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
                {MOCK_SERVICES.map((s, i) => {
                  const inQueue = svcQueue.some((q) => q.id === s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`s2-addProdCard s2-addProdCard--service${inQueue ? ' is-inQueue' : ''}`}
                      onClick={() => {
                        setSvcQueue((prev) =>
                          prev.some((q) => q.id === s.id)
                            ? prev.filter((q) => q.id !== s.id)
                            : [...prev, s],
                        );
                      }}
                    >
                      <div
                        className="s2-addProdCard__visual"
                        style={{ background: svcGradientForIndex(i) }}
                        aria-hidden
                      />
                      <div className="s2-addProdCard__meta">
                        <div className="s2-addProdCard__name s2-addProdCard__name--service">{s.name}</div>
                        <div className="s2-addProdCard__price">{queuePriceLabel(s)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <footer className="s2-svcPickQueue">
              <div className="s2-svcPickQueue__label">S2 QUEUE</div>
              <div className="s2-svcPickQueue__row">
                {svcQueue.map((s, qi) => (
                  <div key={`${s.id}-${qi}`} className="s2-svcPickQueueCard">
                    <button
                      type="button"
                      className="s2-svcPickQueueCard__rm"
                      aria-label={`Remove ${s.name}`}
                      onClick={() => setSvcQueue((prev) => prev.filter((_, j) => j !== qi))}
                    >
                      <X size={10} weight="bold" aria-hidden />
                    </button>
                    <div
                      className="s2-svcPickQueueCard__thumb"
                      style={{
                        background: svcGradientForIndex(
                          (() => {
                            const ix = MOCK_SERVICES.findIndex((x) => x.id === s.id);
                            return ix >= 0 ? ix : qi;
                          })(),
                        ),
                      }}
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
                      { id: `SVC-C-${Date.now()}`, name: 'Custom service', price: 100 },
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
                      onClick={() => setProductQueue((prev) => prev.filter((_, j) => j !== qi))}
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

    </div>
  );
}
