import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CaretLeft } from "phosphor-react";
import "../style/climax.css";
import { MOCK_PRODUCTS } from "../../data/mockProducts";
import { MOCK_SERVICES } from "../../data/mockServices";
import {
  apptStateKey,
  buildAptNavPayload,
  getApptState,
  loadApptStateStore,
  readPersistedClimaxBack,
  readPersistedScreen2Apt,
  readPersistedScreen2From,
  saveApptStateStore,
  SVC_CONSULT_BASE,
  SVC_HOURLY_BASE,
  writePersistedClimaxBack,
} from "../../data/appointmentStateStore";
import {
  isSameLocalDay,
  useCalendarEvents,
} from "../../data/calendarEventsStore";
import { useTheme } from "../../context/ThemeContext";

// Climax = checkout. Everything here is driven by the active appointment:
//   * services + products = `appointmentStateStore` keyed by apt id (the same
//     bag Screen2 writes to when the stylist adds/removes from the queue).
//   * client name + date  = the apt itself.
//   * Hourly + Consultation prices come from the apt's hourlyRate / consultRate
//     (dollar value), surfaced as regular service rows so they're part of the
//     ticket math just like any other service.
//
// Resolution order for the active appointment:
//   1. router state (`location.state.apt`) — passed by Screen2 / Stylist
//      bottom-toolbar / Calendar.
//   2. session-saved last apt — survives full refresh.
//   3. earliest of today's calendar events — sensible default.

const FUTURE_APPOINTMENT = {
  label: "5/15/2024 - Haircut",
  price: 20,
};

// Rate slider bounds — same range Screen2 uses for hourly + consult so the two
// screens stay in lockstep ($0–$310, $1 steps).
const ADJ_RATE_MIN = 0;
const ADJ_RATE_MAX = 310;
function clampAdjustableRate(n) {
  const v = Math.round(Number(n));
  if (Number.isNaN(v)) return 0;
  return Math.min(ADJ_RATE_MAX, Math.max(ADJ_RATE_MIN, v));
}

function formatMoney(n) {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

function formatDateLong(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function newSvcId() {
  return `svc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
function newProdId() {
  return `prd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Horizontal edge swipe: right (back) mirrors left (next tab → Calendar). */
function resolveClimaxHorizontalSwipe(dx, dy, dt, startLocalX, width) {
  if (dt > 1200 || Math.abs(dy) > 90) return null;
  if (Math.abs(dx) < Math.abs(dy) * 1.35) return null;
  const fromLeftEdge = startLocalX <= 48;
  const fromRightEdge = width > 0 && startLocalX >= width - 48;

  if (dx > 0) {
    const edgeCommit = fromLeftEdge && dx >= 38;
    const longCommit = dx >= 76 && Math.abs(dy) < 72;
    if (edgeCommit || longCommit) return "back";
  } else if (dx < 0) {
    const edgeCommit = fromRightEdge && dx <= -38;
    const longCommit = dx <= -76 && Math.abs(dy) < 72;
    if (edgeCommit || longCommit) return "calendar";
  }
  return null;
}

// Treat the Hourly / Consultation rows as regular service rows for the ticket,
// using the per-apt rate as their price. They're also editable (long-press
// Edit just updates the matching rate via `onApplyRateEdit` below).
function rolloutSvcQueueForCheckout(svcQueue, hourlyRate, consultRate) {
  const out = (svcQueue || []).map((s) => {
    if (s.id === SVC_HOURLY_BASE.id) {
      return { ...s, name: "Hourly", price: Number(hourlyRate) || 0 };
    }
    if (s.id === SVC_CONSULT_BASE.id) {
      return { ...s, name: "Consultation", price: Number(consultRate) || 0 };
    }
    return { ...s, price: Number(s.price) || 0 };
  });
  // Drop $0 anchor rows so the ticket only lists what the stylist actually
  // billed. They're still preserved in the underlying queue (Screen2 needs
  // them) — this filter is purely for the checkout view.
  return out.filter((s) => {
    const isAnchor = s.id === SVC_HOURLY_BASE.id || s.id === SVC_CONSULT_BASE.id;
    return !isAnchor || s.price > 0;
  });
}

export default function Climax() {
  const location = useLocation();
  const navigate = useNavigate();
  const calendarEvents = useCalendarEvents();
  const { primaryHex } = useTheme();

  // ------- Resolve active appointment -------
  const activeApt = useMemo(() => {
    const navApt = location?.state?.apt || null;
    if (navApt) return navApt;
    const session = readPersistedScreen2Apt();
    if (session) return session;
    const today = new Date();
    const todays = calendarEvents
      .filter((ev) => isSameLocalDay(ev.start, today))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    return todays.length ? buildAptNavPayload(todays[0]) : null;
    // calendarEvents is the only varying dep we care about here; nav state is
    // captured via location key so we re-resolve when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, calendarEvents]);

  const apptKey = apptStateKey(activeApt);

  // Remember checkout "back" across refresh (paired with `state.from` on navigate).
  useEffect(() => {
    const fromNav = location?.state?.from;
    if (typeof fromNav === "string" && fromNav.startsWith("/")) {
      writePersistedClimaxBack(fromNav);
    }
  }, [location.key, location?.state?.from]);

  const climaxBackTarget = useMemo(() => {
    const fromState = location?.state?.from;
    if (typeof fromState === "string" && fromState.startsWith("/")) return fromState;
    const persisted = readPersistedClimaxBack();
    if (persisted) return persisted;
    return "/screen2";
  }, [location.key, location?.state?.from]);

  const handleClimaxBack = useCallback(() => {
    const apt = activeApt || readPersistedScreen2Apt();
    if (climaxBackTarget === "/screen2" && apt) {
      const s2From = readPersistedScreen2From();
      navigate("/screen2", {
        state: { apt, from: s2From && s2From.startsWith("/") ? s2From : "/screen1" },
      });
      return;
    }
    navigate(climaxBackTarget);
  }, [activeApt, climaxBackTarget, navigate]);

  const navigateSwipeToCalendar = useCallback(() => {
    navigate("/calendar", { state: { from: "/climax" } });
  }, [navigate]);

  // ------- Per-appointment data (services + products + rates) -------
  const [aptState, setAptState] = useState(() =>
    getApptState(loadApptStateStore(), activeApt),
  );

  // Re-read when the active appointment changes (user navigated to a different
  // appointment without unmounting Climax). Also subscribe to in-tab edits the
  // Screen2 store fires through the same localStorage key.
  useEffect(() => {
    setAptState(getApptState(loadApptStateStore(), activeApt));
  }, [apptKey, activeApt]);

  useEffect(() => {
    const onStorage = (e) => {
      if (!e || e.key === null || e.key === "@salonx/appointmentState/v1") {
        setAptState(getApptState(loadApptStateStore(), activeApt));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [activeApt]);

  // Persist outward whenever Climax mutates the per-apt bag.
  const persistAptState = useCallback(
    (next) => {
      setAptState(next);
      if (!apptKey) return;
      const store = loadApptStateStore();
      store[apptKey] = {
        ...next,
        updatedAt: Date.now(),
      };
      saveApptStateStore(store);
    },
    [apptKey],
  );

  // Selected-product toggles are session-only ("on the ticket?"). Default ON
  // for any product Screen2 added to this appointment.
  const [selectedProducts, setSelectedProducts] = useState({});
  useEffect(() => {
    setSelectedProducts(
      Object.fromEntries((aptState.productQueue || []).map((p) => [p.id, true])),
    );
  }, [apptKey, aptState.productQueue]);

  const [globalDiscount, setGlobalDiscount] = useState({ value: 0, isPercent: false });
  useEffect(() => {
    // Reset per-ticket discount when switching appointments.
    setGlobalDiscount({ value: 0, isPercent: false });
  }, [apptKey]);

  // Header strings from the appointment itself.
  const clientHeader = useMemo(() => {
    const name = (activeApt?.clientName || "").trim() || "Walk-in";
    const date = activeApt?.start ? formatDateLong(activeApt.start) : formatDateLong(new Date());
    return { name, date };
  }, [activeApt]);

  // Ticket rows = real services from the queue (with hourly / consult rate
  // injected). Recomputed on every render because rates may change live.
  const services = useMemo(
    () => rolloutSvcQueueForCheckout(aptState.svcQueue, aptState.hourlyRate, aptState.consultRate),
    [aptState.svcQueue, aptState.hourlyRate, aptState.consultRate],
  );
  const products = aptState.productQueue || [];

  const totals = useMemo(() => {
    const serviceTotal = services.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    const productTotal = products.reduce(
      (sum, p) => sum + (selectedProducts[p.id] ? (Number(p.price) || 0) : 0),
      0,
    );
    let total = serviceTotal + productTotal;
    if (globalDiscount.value > 0) {
      total = globalDiscount.isPercent
        ? Math.max(0, total - total * (globalDiscount.value / 100))
        : Math.max(0, total - globalDiscount.value);
    }
    return { serviceTotal, productTotal, total };
  }, [services, products, selectedProducts, globalDiscount]);

  // ------- Mutations on per-apt store -------
  const setHourlyRate = useCallback(
    (n) => persistAptState({ ...aptState, hourlyRate: Math.max(0, Number(n) || 0) }),
    [aptState, persistAptState],
  );
  const setConsultRate = useCallback(
    (n) => persistAptState({ ...aptState, consultRate: Math.max(0, Number(n) || 0) }),
    [aptState, persistAptState],
  );

  const replaceSvcQueue = useCallback(
    (mutator) => persistAptState({ ...aptState, svcQueue: mutator(aptState.svcQueue || []) }),
    [aptState, persistAptState],
  );
  const replaceProductQueue = useCallback(
    (mutator) =>
      persistAptState({
        ...aptState,
        productQueue: mutator(aptState.productQueue || []),
      }),
    [aptState, persistAptState],
  );

  const addServiceFromCatalog = useCallback(
    (svc) => {
      const newSvc = { id: newSvcId(), name: svc.name, price: Number(svc.price) || 0 };
      replaceSvcQueue((prev) => [...prev, newSvc]);
    },
    [replaceSvcQueue],
  );

  const addProductFromCatalog = useCallback(
    (prd) => {
      const newId = newProdId();
      const newProd = {
        id: newId,
        brand: prd.brand || "",
        name: prd.name,
        price: Number(prd.price) || 0,
        color: prd.color || primaryHex,
        accent: primaryHex,
      };
      replaceProductQueue((prev) => [...prev, newProd]);
      setSelectedProducts((prev) => ({ ...prev, [newId]: true }));
    },
    [replaceProductQueue, primaryHex],
  );

  const editServiceById = useCallback(
    (id, patch) => {
      // Anchor rows (Hourly / Consultation) only support price edits — name is fixed.
      if (id === SVC_HOURLY_BASE.id) {
        if (typeof patch.price === "number") setHourlyRate(patch.price);
        return;
      }
      if (id === SVC_CONSULT_BASE.id) {
        if (typeof patch.price === "number") setConsultRate(patch.price);
        return;
      }
      replaceSvcQueue((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      );
    },
    [replaceSvcQueue, setHourlyRate, setConsultRate],
  );

  const editProductById = useCallback(
    (id, patch) =>
      replaceProductQueue((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      ),
    [replaceProductQueue],
  );

  const deleteServiceById = useCallback(
    (id) => {
      // Don't allow removing the anchor rows from the queue — just zero them out.
      if (id === SVC_HOURLY_BASE.id) {
        setHourlyRate(0);
        return;
      }
      if (id === SVC_CONSULT_BASE.id) {
        setConsultRate(0);
        return;
      }
      replaceSvcQueue((prev) => prev.filter((s) => s.id !== id));
    },
    [replaceSvcQueue, setHourlyRate, setConsultRate],
  );

  const deleteProductById = useCallback(
    (id) => {
      replaceProductQueue((prev) => prev.filter((p) => p.id !== id));
      setSelectedProducts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [replaceProductQueue],
  );

  const discountAllServices = useCallback(
    (value, isPercent) => {
      const apply = (p) =>
        isPercent ? Math.max(0, p - p * (value / 100)) : Math.max(0, p - value);
      replaceSvcQueue((prev) => prev.map((s) => ({ ...s, price: apply(Number(s.price) || 0) })));
      // Also discount the rate-driven rows
      setHourlyRate(apply(Number(aptState.hourlyRate) || 0));
      setConsultRate(apply(Number(aptState.consultRate) || 0));
    },
    [aptState.consultRate, aptState.hourlyRate, replaceSvcQueue, setConsultRate, setHourlyRate],
  );

  const discountAllProducts = useCallback(
    (value, isPercent) => {
      const apply = (p) =>
        isPercent ? Math.max(0, p - p * (value / 100)) : Math.max(0, p - value);
      replaceProductQueue((prev) =>
        prev.map((p) => ({ ...p, price: apply(Number(p.price) || 0) })),
      );
    },
    [replaceProductQueue],
  );

  // ------- Modals (modify / edit / select / discount / rate-edit) -------
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifyTarget, setModifyTarget] = useState(null); // { type, id }
  const [editModal, setEditModal] = useState(null);
  // 'hourly' | 'consult' | null — slider popup that lives ABOVE the other modals
  const [rateEditOpen, setRateEditOpen] = useState(null);

  const longPressTimeout = useRef(null);
  const handleLongPress = (callback, ms = 600) => ({
    onPointerDown: () => {
      if (longPressTimeout.current) clearTimeout(longPressTimeout.current);
      longPressTimeout.current = setTimeout(callback, ms);
    },
    onPointerUp: () => clearTimeout(longPressTimeout.current),
    onPointerLeave: () => clearTimeout(longPressTimeout.current),
    onContextMenu: (e) => e.preventDefault(),
  });

  function openModify(type, id) {
    setModifyTarget({ type, id });
    setModifyOpen(true);
  }
  function closeModify() {
    setModifyOpen(false);
    setModifyTarget(null);
  }

  /** Horizontal swipe: right → back; left → Calendar (tab order after Checkout). */
  const climaxRootRef = useRef(null);
  const climaxSwipeGestureRef = useRef({
    active: false,
    captured: false,
    captureEl: null,
    pointerType: "mouse",
    width: 0,
    startLocalX: 0,
    x: 0,
    y: 0,
    ts: 0,
    pointerId: null,
  });
  const blockClimaxSwipeRef = useRef(false);
  const climaxSwipeCooldownRef = useRef(0);

  useEffect(() => {
    blockClimaxSwipeRef.current = !!(modifyOpen || editModal || rateEditOpen);
  }, [modifyOpen, editModal, rateEditOpen]);

  const climaxSwipeTargetFilter = useCallback((target) => {
    if (!target?.closest) return false;
    return !target.closest(".climax-modal");
  }, []);

  const onClimaxSwipePointerDown = useCallback((e) => {
    if (blockClimaxSwipeRef.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!climaxSwipeTargetFilter(e.target)) return;
    const el = climaxRootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    climaxSwipeGestureRef.current = {
      active: true,
      captured: false,
      captureEl: e.currentTarget,
      pointerType: e.pointerType || "mouse",
      width: rect.width,
      startLocalX: e.clientX - rect.left,
      x: e.clientX,
      y: e.clientY,
      ts: Date.now(),
      pointerId: e.pointerId ?? null,
    };
  }, [climaxSwipeTargetFilter]);

  const onClimaxSwipePointerMove = useCallback((e) => {
    const ref = climaxSwipeGestureRef.current;
    if (!ref.active || blockClimaxSwipeRef.current) return;
    if (ref.pointerId != null && e.pointerId !== ref.pointerId) return;
    const dx = e.clientX - ref.x;
    const dy = e.clientY - ref.y;
    const captureThreshold =
      ref.pointerType === "touch" || ref.pointerType === "pen" ? 8 : 12;
    if (
      Math.abs(dx) > captureThreshold &&
      Math.abs(dx) > Math.abs(dy) &&
      !ref.captured
    ) {
      const cap = ref.captureEl;
      if (cap && typeof cap.setPointerCapture === "function") {
        try {
          cap.setPointerCapture(e.pointerId);
          ref.captured = true;
        } catch (_) {
          /* noop */
        }
      }
    }
  }, []);

  const releaseClimaxSwipeCapture = useCallback((e) => {
    const ref = climaxSwipeGestureRef.current;
    if (ref.captured && ref.captureEl && e.pointerId != null) {
      try {
        ref.captureEl.releasePointerCapture(e.pointerId);
      } catch (_) {
        /* noop */
      }
    }
    ref.captured = false;
  }, []);

  const onClimaxSwipePointerUp = useCallback(
    (e) => {
      const ref = climaxSwipeGestureRef.current;
      if (!ref.active) return;
      if (ref.pointerId != null && e.pointerId != null && e.pointerId !== ref.pointerId) return;

      releaseClimaxSwipeCapture(e);
      ref.active = false;

      const dx = e.clientX - ref.x;
      const dy = e.clientY - ref.y;
      const dt = Date.now() - ref.ts;
      const resolved = resolveClimaxHorizontalSwipe(dx, dy, dt, ref.startLocalX, ref.width);

      if (!resolved) return;

      const now = Date.now();
      if (now - climaxSwipeCooldownRef.current < 380) return;
      climaxSwipeCooldownRef.current = now;

      if (resolved === "back") handleClimaxBack();
      else navigateSwipeToCalendar();
    },
    [handleClimaxBack, navigateSwipeToCalendar, releaseClimaxSwipeCapture],
  );

  const onClimaxSwipePointerCancel = useCallback(
    (e) => {
      releaseClimaxSwipeCapture(e);
      climaxSwipeGestureRef.current.active = false;
    },
    [releaseClimaxSwipeCapture],
  );

  useEffect(() => {
    const el = climaxRootRef.current;
    if (!el) return;

    const touchStart = (ev) => {
      if (blockClimaxSwipeRef.current) return;
      if (ev.touches.length !== 1) return;
      if (!climaxSwipeTargetFilter(ev.target)) return;
      const rect = el.getBoundingClientRect();
      const t = ev.touches[0];
      climaxSwipeGestureRef.current = {
        active: true,
        captured: false,
        captureEl: null,
        pointerType: "touch",
        width: rect.width,
        startLocalX: t.clientX - rect.left,
        x: t.clientX,
        y: t.clientY,
        ts: Date.now(),
        pointerId: null,
      };
    };

    const touchEnd = (ev) => {
      const ref = climaxSwipeGestureRef.current;
      if (!ref.active) return;
      climaxSwipeGestureRef.current.active = false;
      const t = ev.changedTouches[0];
      if (!t) return;

      const dx = t.clientX - ref.x;
      const dy = t.clientY - ref.y;
      const dt = Date.now() - ref.ts;
      const resolved = resolveClimaxHorizontalSwipe(dx, dy, dt, ref.startLocalX, ref.width);

      if (!resolved) return;

      const now = Date.now();
      if (now - climaxSwipeCooldownRef.current < 380) return;
      climaxSwipeCooldownRef.current = now;

      if (resolved === "back") handleClimaxBack();
      else navigateSwipeToCalendar();
    };

    const touchCancel = () => {
      climaxSwipeGestureRef.current.active = false;
    };

    el.addEventListener("touchstart", touchStart, { passive: true });
    el.addEventListener("touchend", touchEnd, { passive: true });
    el.addEventListener("touchcancel", touchCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", touchStart);
      el.removeEventListener("touchend", touchEnd);
      el.removeEventListener("touchcancel", touchCancel);
    };
  }, [handleClimaxBack, navigateSwipeToCalendar, climaxSwipeTargetFilter]);

  const accent = primaryHex;

  const hasNoTicketLines = services.length === 0 && products.length === 0;

  return (
    <div
      ref={climaxRootRef}
      className="climax-root"
      style={{ ["--climax-accent"]: accent }}
      onPointerDown={onClimaxSwipePointerDown}
      onPointerMove={onClimaxSwipePointerMove}
      onPointerUp={onClimaxSwipePointerUp}
      onPointerCancel={onClimaxSwipePointerCancel}
    >
      <button
        type="button"
        className="climax-backBtn"
        onClick={handleClimaxBack}
        aria-label="Back"
      >
        <CaretLeft size={28} weight="bold" aria-hidden />
      </button>
      <div className="climax-brandbar" aria-label="Co-brand header area">
        <img className="climax-brandbar__logo" src="/l3vel3.png" alt="L3VEL3" />
      </div>

      <div className="climax-stage" aria-label="ClimaX stage">
        <div className="climax-inlayPhotoWrap" aria-hidden>
          <img
            className="climax-inlayPhoto"
            src="/climax-inlay.png"
            alt=""
            decoding="async"
          />
        </div>
        <div className="climax-inlay" aria-hidden />

        <div className="climax-glass" role="region" aria-label="Glass overlay">
          <div className="climax-scroll">
            <div className="climax-client">
              <div className="climax-client__name">{clientHeader.name}</div>
              <div className="climax-client__date">{clientHeader.date}</div>
            </div>

            <section className="climax-section climax-section--services" aria-label="Services">
              <button
                type="button"
                className="climax-section__title climax-section__titleBtn"
                onClick={() => openModify("service", null)}
              >
                SERVICES
              </button>
              <div className="climax-list">
                {services.length === 0 ? (
                  <button
                    type="button"
                    className="climax-row"
                    onClick={() =>
                      setEditModal({
                        mode: "select",
                        type: "service",
                        id: null,
                        name: "",
                        price: "",
                      })
                    }
                  >
                    <span
                      className="climax-row__label"
                      style={{ opacity: 0.55, paddingLeft: 14, textAlign: "left" }}
                    >
                      No services yet — tap to add
                    </span>
                  </button>
                ) : (
                  services.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="climax-row"
                      onClick={() => openModify("service", s.id)}
                    >
                      <span className="climax-row__label">{s.name}</span>
                      <span className="climax-row__value">{formatMoney(s.price)}</span>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section
              className="climax-section climax-section--products"
              aria-label="Finish care"
            >
              <button
                type="button"
                className="climax-section__title climax-section__titleBtn"
                onClick={() => openModify("product", null)}
              >
                FINISH CARE
              </button>
              <div className="climax-list">
                {products.length === 0 ? (
                  <button
                    type="button"
                    className="climax-row"
                    onClick={() =>
                      setEditModal({
                        mode: "select",
                        type: "product",
                        id: null,
                        name: "",
                        price: "",
                      })
                    }
                  >
                    <span
                      className="climax-row__label"
                      style={{ opacity: 0.55, paddingLeft: 14, textAlign: "left" }}
                    >
                      No products yet — tap to add
                    </span>
                  </button>
                ) : (
                  products.map((p) => {
                    const on = !!selectedProducts[p.id];
                    return (
                      <div key={p.id} className="climax-row climax-row--static">
                        <button
                          type="button"
                          className="climax-row__touch"
                          onClick={() => openModify("product", p.id)}
                          aria-label={`Modify ${p.name}`}
                        >
                          <span className="climax-row__label">
                            {p.brand ? `${p.brand} ${p.name}` : p.name}
                          </span>
                          <span className="climax-row__value">{formatMoney(p.price)}</span>
                        </button>

                        <button
                          type="button"
                          className={`climax-pill ${on ? "is-on" : "is-off"}`}
                          onClick={() =>
                            setSelectedProducts((prev) => ({
                              ...prev,
                              [p.id]: !prev[p.id],
                            }))
                          }
                          aria-pressed={on}
                          aria-label={`${p.name} ${on ? "on" : "off"}`}
                        >
                          <span className="climax-pill__track" />
                          <span className="climax-pill__thumb" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <div className="climax-divider" />

            <section className="climax-section climax-section--future" aria-label="Future appointment">
              <div className="climax-section__title">FUTURE APPOINTMENT</div>
              <div className="climax-list">
                <div className="climax-row climax-row--static">
                  <div className="climax-row__touch" aria-hidden="true">
                    <span className="climax-row__label">{FUTURE_APPOINTMENT.label}</span>
                  </div>
                </div>
              </div>
            </section>

            <div className="climax-divider" />

            <div
              className="climax-total"
              {...handleLongPress(() =>
                setEditModal({ mode: "discountTicket", type: "ticket", id: null, name: "", price: "" }),
              )}
              style={{ userSelect: "none", WebkitTouchCallout: "none", cursor: "pointer" }}
            >
              <span>Total</span>
              <span>{formatMoney(totals.total)}</span>
            </div>

            {hasNoTicketLines && !apptKey ? (
              <div
                className="climax-row climax-row--static"
                style={{ marginTop: 12, padding: 12 }}
              >
                <span className="climax-row__label" style={{ opacity: 0.6 }}>
                  No appointment selected. Open one from Stylist or Calendar.
                </span>
                <button
                  type="button"
                  className="climax-pill is-on"
                  onClick={() => navigate("/screen1")}
                  aria-label="Go to Stylist"
                  style={{ minWidth: 60 }}
                >
                  <span className="climax-pill__track" />
                  <span className="climax-pill__thumb" />
                </button>
              </div>
            ) : null}
          </div>

          <div className="climax-footer">
            <div className="climax-actions" aria-label="Payment actions">
              <button type="button" className="climax-actionBtn">CASH</button>
              <button type="button" className="climax-actionBtn">CREDIT</button>
              <button type="button" className="climax-actionBtn">OTHER</button>
            </div>
          </div>
        </div>
      </div>

      {modifyOpen ? (
        <div className="climax-modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="climax-modal__backdrop"
            onClick={closeModify}
            aria-label="Close"
          />
          <div className="climax-modal__panel">
            <div className="climax-modal__title">Modify</div>
            <div className="climax-modal__subtitle">
              {modifyTarget?.type === "service" ? "Service" : "Product"}
            </div>

            <div className="climax-modal__grid">
              <button
                type="button"
                className="climax-modal__btn"
                onClick={() => {
                  if (!modifyTarget || !modifyTarget.id) return;
                  // Hourly / Consultation share the Screen2 slider popup so
                  // editing them in Climax feels identical.
                  if (modifyTarget.type === "service") {
                    if (modifyTarget.id === SVC_HOURLY_BASE.id) {
                      setRateEditOpen("hourly");
                      closeModify();
                      return;
                    }
                    if (modifyTarget.id === SVC_CONSULT_BASE.id) {
                      setRateEditOpen("consult");
                      closeModify();
                      return;
                    }
                  }
                  const item =
                    modifyTarget.type === "service"
                      ? services.find((i) => i.id === modifyTarget.id)
                      : products.find((i) => i.id === modifyTarget.id);
                  if (item) {
                    setEditModal({
                      mode: "change",
                      type: modifyTarget.type,
                      id: item.id,
                      name: item.name || "",
                      price: String(item.price ?? ""),
                    });
                  }
                  closeModify();
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="climax-modal__btn"
                onClick={() => {
                  setEditModal({
                    mode: "select",
                    type: modifyTarget?.type || "service",
                    id: null,
                    name: "",
                    price: "",
                  });
                  closeModify();
                }}
              >
                Add
              </button>
              <button
                type="button"
                className="climax-modal__btn"
                onClick={() => {
                  if (!modifyTarget || !modifyTarget.id) return;
                  if (modifyTarget.type === "service") {
                    deleteServiceById(modifyTarget.id);
                  } else {
                    deleteProductById(modifyTarget.id);
                  }
                  closeModify();
                }}
              >
                Delete
              </button>
              <button
                type="button"
                className="climax-modal__btn"
                onClick={() => {
                  if (!modifyTarget || !modifyTarget.id) return;
                  setEditModal({
                    mode: "discount",
                    type: modifyTarget.type,
                    id: modifyTarget.id,
                    name: "",
                    price: "",
                  });
                  closeModify();
                }}
              >
                Discount
              </button>
              <button
                type="button"
                className="climax-modal__btn climax-modal__btn--wide"
                onClick={() => {
                  setEditModal({
                    mode: "discountAll",
                    type: modifyTarget?.type || "service",
                    id: null,
                    name: "",
                    price: "",
                  });
                  closeModify();
                }}
              >
                Discount All {modifyTarget?.type === "service" ? "Services" : "Products"}
              </button>
            </div>

            <button type="button" className="climax-modal__close" onClick={closeModify}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {editModal ? (
        <div className="climax-modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="climax-modal__backdrop"
            onClick={() => setEditModal(null)}
            aria-label="Close"
          />
          <div className="climax-modal__panel">
            <div className="climax-modal__title">
              {editModal.mode === "change"
                ? "Edit"
                : editModal.mode === "select"
                ? "Select"
                : editModal.mode === "discount"
                ? "Discount"
                : editModal.mode === "discountTicket"
                ? "Discount Ticket"
                : "Discount All"}{" "}
              {editModal.type === "ticket"
                ? ""
                : editModal.type === "service"
                ? "Service"
                : "Product"}
            </div>

            {editModal.mode === "select" ? (
              <div
                className="climax-scroll"
                style={{
                  maxHeight: "300px",
                  marginTop: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {editModal.type === "service"
                  ? (
                    <>
                      {/* Hourly + Consultation are anchor rows on the per-apt
                          store, not duplicable catalog items. Clicking them
                          opens the Screen2-style slider popup so the stylist
                          can dial in the rate. */}
                      <button
                        type="button"
                        className="climax-row"
                        onClick={() => {
                          setEditModal(null);
                          setRateEditOpen("hourly");
                        }}
                      >
                        <span className="climax-row__label" style={{ textAlign: "left" }}>
                          Hourly
                        </span>
                        <span className="climax-row__value">
                          {aptState.hourlyRate > 0 ? formatMoney(aptState.hourlyRate) + "/hr" : "Set"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="climax-row"
                        onClick={() => {
                          setEditModal(null);
                          setRateEditOpen("consult");
                        }}
                      >
                        <span className="climax-row__label" style={{ textAlign: "left" }}>
                          Consultation
                        </span>
                        <span className="climax-row__value">
                          {aptState.consultRate > 0 ? formatMoney(aptState.consultRate) : "Set"}
                        </span>
                      </button>
                      {MOCK_SERVICES.map((svc) => (
                        <button
                          key={svc.id}
                          type="button"
                          className="climax-row"
                          onClick={() => {
                            addServiceFromCatalog(svc);
                            setEditModal(null);
                          }}
                        >
                          <span className="climax-row__label" style={{ textAlign: "left" }}>
                            {svc.name}
                          </span>
                          <span className="climax-row__value">{formatMoney(svc.price)}</span>
                        </button>
                      ))}
                    </>
                  )
                  : MOCK_PRODUCTS.map((prd) => (
                      <button
                        key={prd.id}
                        type="button"
                        className="climax-row"
                        onClick={() => {
                          addProductFromCatalog(prd);
                          setEditModal(null);
                        }}
                      >
                        <span className="climax-row__label" style={{ textAlign: "left" }}>
                          {prd.brand ? `${prd.brand} ${prd.name}` : prd.name}
                        </span>
                        <span className="climax-row__value">{formatMoney(prd.price)}</span>
                      </button>
                    ))}
              </div>
            ) : (
              <div className="climax-form">
                {editModal.mode === "change" && (
                  <input
                    className="climax-input"
                    value={editModal.name}
                    onChange={(e) =>
                      setEditModal((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Name"
                  />
                )}
                <input
                  className="climax-input"
                  type={editModal.mode.includes("discount") ? "text" : "number"}
                  value={editModal.price}
                  onChange={(e) =>
                    setEditModal((prev) => ({ ...prev, price: e.target.value }))
                  }
                  placeholder={
                    editModal.mode.includes("discount")
                      ? "Discount (e.g. 10 or 10%)"
                      : "Price"
                  }
                />
              </div>
            )}

            <div className="climax-modal__grid" style={{ marginTop: 14 }}>
              {editModal.mode !== "select" && (
                <button
                  type="button"
                  className="climax-modal__btn"
                  onClick={() => {
                    const { mode, type, id, name, price } = editModal;
                    const priceStr = price.toString().trim();
                    const isPercent = priceStr.endsWith("%");
                    const numPrice = Number(priceStr.replace("%", "")) || 0;

                    if (mode === "change") {
                      if (type === "service") {
                        editServiceById(id, {
                          name: name || undefined,
                          price: numPrice,
                        });
                      } else {
                        editProductById(id, {
                          name: name || undefined,
                          price: numPrice,
                        });
                      }
                    } else if (mode === "discount") {
                      const apply = (p) =>
                        isPercent
                          ? Math.max(0, p - p * (numPrice / 100))
                          : Math.max(0, p - numPrice);
                      if (type === "service") {
                        const target = services.find((s) => s.id === id);
                        if (target) editServiceById(id, { price: apply(target.price) });
                      } else {
                        const target = products.find((p) => p.id === id);
                        if (target) editProductById(id, { price: apply(target.price) });
                      }
                    } else if (mode === "discountAll") {
                      if (type === "service") discountAllServices(numPrice, isPercent);
                      else discountAllProducts(numPrice, isPercent);
                    } else if (mode === "discountTicket") {
                      setGlobalDiscount({ value: numPrice, isPercent });
                    }
                    setEditModal(null);
                  }}
                >
                  Save
                </button>
              )}
              <button
                type="button"
                className={`climax-modal__btn ${
                  editModal.mode === "select" ? "climax-modal__btn--wide" : ""
                }`}
                onClick={() => setEditModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rateEditOpen ? (
        <div
          className="climax-modal climax-rateEdit"
          role="dialog"
          aria-modal="true"
          aria-label={rateEditOpen === "hourly" ? "Hourly rate" : "Consultation fee"}
        >
          <button
            type="button"
            className="climax-modal__backdrop"
            aria-label="Close"
            onClick={() => setRateEditOpen(null)}
          />
          <div className="climax-modal__panel climax-rateEdit__panel">
            <div className="climax-modal__title">
              {rateEditOpen === "hourly" ? "Hourly rate" : "Consultation fee"}
            </div>
            <div className="climax-modal__subtitle">
              {rateEditOpen === "hourly"
                ? `$${ADJ_RATE_MIN}–$${ADJ_RATE_MAX} per hour · $1 steps`
                : `$${ADJ_RATE_MIN}–$${ADJ_RATE_MAX} consultation · $1 steps`}
            </div>

            {(() => {
              const isHourly = rateEditOpen === "hourly";
              const rateVal = isHourly ? aptState.hourlyRate : aptState.consultRate;
              const setRateVal = isHourly ? setHourlyRate : setConsultRate;
              const fillPct =
                ADJ_RATE_MAX > ADJ_RATE_MIN
                  ? ((rateVal - ADJ_RATE_MIN) / (ADJ_RATE_MAX - ADJ_RATE_MIN)) * 100
                  : 0;
              return (
                <div className="climax-rateEdit__body">
                  <div className="climax-rateEdit__big">
                    ${rateVal}
                    {isHourly ? <span className="climax-rateEdit__suffix">/hr</span> : null}
                  </div>
                  <input
                    type="range"
                    className="climax-rateEdit__slider"
                    min={ADJ_RATE_MIN}
                    max={ADJ_RATE_MAX}
                    step={1}
                    value={rateVal}
                    aria-valuemin={ADJ_RATE_MIN}
                    aria-valuemax={ADJ_RATE_MAX}
                    aria-valuenow={rateVal}
                    style={{ "--rate-fill": `${fillPct}%` }}
                    onChange={(e) => setRateVal(clampAdjustableRate(e.target.value))}
                  />
                  <label className="climax-rateEdit__field">
                    <span className="climax-rateEdit__fieldLabel">
                      {isHourly ? "$ / hour" : "$ consultation"}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="climax-rateEdit__input"
                      min={ADJ_RATE_MIN}
                      max={ADJ_RATE_MAX}
                      step={1}
                      value={rateVal}
                      onChange={(e) => setRateVal(clampAdjustableRate(e.target.value))}
                    />
                  </label>
                </div>
              );
            })()}

            <div className="climax-modal__grid" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="climax-modal__btn climax-modal__btn--wide"
                onClick={() => setRateEditOpen(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
