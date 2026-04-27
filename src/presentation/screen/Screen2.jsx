import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarBlank,
  Camera,
  Lightning,
  Microphone,
  Scissors,
  User,
  X,
} from 'phosphor-react';
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

const SERVICES = [
  { id: 'balayage', name: 'Balayage', price: '$150', state: 'active' },
  { id: 'toner', name: 'Toner Application', price: '$60', state: 'active' },
  { id: 'deep', name: 'Deep Conditioning Treatment', price: '$50', state: 'recommended' },
];

const HOME_CARE = [
  { id: 'rusk1', brand: 'RUSK', name: 'Rusk COLORxConditioner', price: '$25' },
  { id: 'rusk2', brand: 'RUSK', name: 'Rusk VHAB Shampoo', price: '$30' },
];

export default function Screen2() {
  const navigate = useNavigate();
  const [consultOpen, setConsultOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);

  const grabberTouch = useRef({ y: 0 });
  const navTouch = useRef({ x: 0, y: 0 });

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
    if (consultOpen) return;
    const t = e.touches[0];
    navTouch.current = { x: t.clientX, y: t.clientY };
  }, [consultOpen]);

  const onRootTouchEnd = useCallback((e) => {
    if (consultOpen) return;
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
  }, [consultOpen, navigate]);

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
            {SERVICES.map((s) => (
              <div key={s.id} className={`s2-svcRow${s.state === 'recommended' ? ' is-rec' : ''}`}>
                <div className="s2-svcRow__left">
                  <span className={`s2-svcBullet${s.state === 'recommended' ? ' is-rec' : ''}`} aria-hidden />
                  <span className="s2-svcName">{s.name}</span>
                </div>
                <span className="s2-svcPrice">{s.price}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="s2-section">
          <div className="s2-pill s2-pill--neutral">Home Care</div>
          <div className="s2-card s2-card--v13 s2-hcCard">
            {HOME_CARE.map((p) => (
              <div key={p.id} className="s2-hcRow">
                <div className="s2-hcThumb">{p.brand}</div>
                <div className="s2-hcName">{p.name}</div>
                <div className="s2-hcPrice">{p.price}</div>
              </div>
            ))}
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

    </div>
  );
}
