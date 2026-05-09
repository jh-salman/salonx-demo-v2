import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Scissors,
  User,
  Lightning,
  CalendarBlank,
  Gear,
  CaretRight,
} from 'phosphor-react';
import CurvedLine from '../../component/CurvedLine';
import { AppContext } from '../../context/AppContext';
import ClientList from '../../component/ClientList';
import SetTimmer from '../../component/SetTimmer';
import WaitingList from '../../component/WaitingList';
import DynamicDate from '../../component/DynamicDate';
import {
  buildAptNavPayload,
  readPersistedScreen2Apt,
} from '../../data/appointmentStateStore';
import {
  isSameLocalDay,
  useCalendarEvents,
} from '../../data/calendarEventsStore';
import '../style/screen1.css';

/** Same UI as Screen1 — duplicate route for screenshots / demo imagery. */
export const S1_DEMO_IMAGE_ROUTE = '/s1-demo-image';

const SCREEN_DEMO_ACTIVE = 0;
const SCREEN_DEMO_TOOLBAR = [
  { Icon: Scissors, label: 'Stylist', to: S1_DEMO_IMAGE_ROUTE },
  { Icon: User, label: 'Clients', to: '/clients' },
  { Icon: Lightning, label: 'Checkout', to: '/climax' },
  { Icon: CalendarBlank, label: 'Calendar', to: '/calendar' },
  { Icon: Gear, label: 'Settings', to: '/settings' },
];

/** @typedef {'topBar' | 'hero' | 'promo' | 'curveStrip'} S1DemoSlotId */
/** @typedef {{ scale: number; rotate: number; tx: number; ty: number; fit: 'cover' | 'contain' }} S1DemoSlotAdjust */

const initialDemoImages = () => ({
  topBar: '',
  hero: '',
  promo: '',
  curveStrip: '',
});

/** @returns {S1DemoSlotAdjust} */
const defaultSlotAdjust = () => ({
  scale: 1,
  rotate: 0,
  tx: 0,
  ty: 0,
  // `contain` so the user's full upload is visible the moment edit mode opens —
  // they can then pinch-zoom in to crop or flip to `cover` via the Fit toggle.
  fit: 'contain',
});

const initialDemoAdjust = () => ({
  topBar: defaultSlotAdjust(),
  hero: defaultSlotAdjust(),
  promo: defaultSlotAdjust(),
  curveStrip: defaultSlotAdjust(),
});

function clampScale(s) {
  // Pinch / wheel can magnify up to 60× (10× the previous 6× cap) for extreme crops.
  return Math.min(60, Math.max(0.35, s));
}
function clampPan(n) {
  return Math.min(50, Math.max(-50, n));
}

/** Persist demo slot images across route changes (`useState` resets on remount). */
const S1_DEMO_IMAGE_SESSION_KEY = '@salonx/s1-demo-image/v1';

/** @typedef {{ images: Record<string, string>; adjust: Record<string, S1DemoSlotAdjust> }} S1PersistedShape */

/** @returns {S1PersistedShape | null} */
function readS1DemoPersisted() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(S1_DEMO_IMAGE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const { images: im, adjust: ad } = parsed;
    if (!im || typeof im !== 'object' || !ad || typeof ad !== 'object')
      return null;

    const nextImages = initialDemoImages();
    const slots = /** @type {S1DemoSlotId[]} */ ([
      'topBar',
      'hero',
      'promo',
      'curveStrip',
    ]);
    for (const slot of slots) {
      const v = im[slot];
      if (typeof v === 'string') nextImages[slot] = v;
    }

    const nextAdjust = initialDemoAdjust();
    for (const slot of slots) {
      const a = ad[slot];
      if (!a || typeof a !== 'object') continue;
      const scale = clampScale(
        typeof a.scale === 'number' ? a.scale : defaultSlotAdjust().scale,
      );
      const tx = clampPan(typeof a.tx === 'number' ? a.tx : 0);
      const ty = clampPan(typeof a.ty === 'number' ? a.ty : 0);
      const rotate = Math.min(
        180,
        Math.max(-180, typeof a.rotate === 'number' ? a.rotate : 0),
      );
      const fit = a.fit === 'contain' || a.fit === 'cover' ? a.fit : 'contain';
      nextAdjust[slot] = { scale, tx, ty, rotate, fit };
    }
    return { images: nextImages, adjust: nextAdjust };
  } catch (_) {
    return null;
  }
}

function persistS1Demo(
  /** @type {Record<S1DemoSlotId, string>} */ images,
  /** @type {Record<S1DemoSlotId, S1DemoSlotAdjust>} */ adjust,
) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(
      S1_DEMO_IMAGE_SESSION_KEY,
      JSON.stringify({ images, adjust }),
    );
  } catch (_) {
    /* quota / private browsing */
  }
}

/** Pinch super-linearity (finger spread → scale). Larger = zoom reacts faster. */
const PINCH_ZOOM_EXPONENT = 8;

/** Wheel / trackpad zoom gain (was 0.0016; ~5× faster feel). */
const WHEEL_ZOOM_GAIN = 0.008;

/**
 * Long-press replace: must open the file input synchronously on pointer up
 * inside the user gesture. A `setTimeout`-delayed `input.click()` is blocked
 * on iOS Safari / many mobile WebViews.
 */
const LONG_PRESS_REPLACE_MS = 520;

function pinchDistance(map) {
  const pts = [...map.values()];
  if (pts.length < 2) return 0;
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}

/**
 * iOS often omits MIME on camera-roll picks; Photos may use HEIC etc.
 */
function isChosenImageFile(/** @type {File | undefined} */ file) {
  if (!file || file.size <= 0) return false;
  if (file.type && file.type.startsWith('image/')) return true;
  if (/\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i.test(file.name))
    return true;
  /* Last resort — let through unknown types from picker (better than silently failing). */
  return !file.type;
}

/** Clearing `<input>` value synchronously inside `change` breaks some iOS WebKit builds. */
function resetFileInputLater(/** @type {HTMLInputElement} */ input) {
  queueMicrotask(() => {
    try {
      input.value = '';
    } catch (_) {
      /* noop */
    }
  });
}

/** Layout box per slot — matches screen1.css on-device slots (demo gray areas). */
const SLOT_PLACEMENT_BOX =
  /** @type {Record<S1DemoSlotId, { w: number; h: number }>} */ ({
    topBar: { w: 393, h: 20 },
    hero: { w: 393, h: 157 },
    promo: { w: 395, h: 70 },
    /** `.curvedline-container`: 65 × full device height (--s1-curve-w × --s1-bg-h) */
    curveStrip: { w: 65, h: 852 },
  });

/**
 * Bottom-sheet pinch viewport only — taller top bar (3× device strip) so gestures
 * aren't cramped. Does not change on-screen layout; main slots + live preview unchanged.
 */
const RESIZE_SHEET_VIEWPORT_BOX =
  /** @type {Record<S1DemoSlotId, { w: number; h: number }>} */ ({
    topBar: { w: SLOT_PLACEMENT_BOX.topBar.w, h: SLOT_PLACEMENT_BOX.topBar.h * 3 },
    hero: { ...SLOT_PLACEMENT_BOX.hero },
    promo: { ...SLOT_PLACEMENT_BOX.promo },
    curveStrip: { ...SLOT_PLACEMENT_BOX.curveStrip },
  });

/** Slot label for the sheet header */
const SLOT_LABEL = {
  topBar: 'Top bar',
  hero: 'Hero',
  promo: 'Promo',
  curveStrip: 'Curve strip',
};

/**
 * Bottom sheet: pinch/drag/wheel here — main device shapes mirror the same
 * adjust state live (masked) so placement vs curve is honest.
 *
 * @param {{
 *   slotId: S1DemoSlotId;
 *   imageSrc: string;
 *   adjust: S1DemoSlotAdjust;
 *   onAdjust: (fn: (a: S1DemoSlotAdjust) => S1DemoSlotAdjust) => void;
 *   onCancel: () => void;
 *   onUpload: () => void;
 *   onReplace: () => void;
 *   onRemove: () => void;
 *   onReset: () => void;
 *   onToggleFit: () => void;
 * }} props
 */
function S1DemoResizeBottomSheet({
  slotId,
  imageSrc,
  adjust,
  onAdjust,
  onCancel,
  onUpload,
  onReplace,
  onRemove,
  onReset,
  onToggleFit,
}) {
  const viewportRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const pointersRef = useRef(new Map());
  /** @type {React.MutableRefObject<{ dist0: number; scale0: number } | null>} */
  const pinchRef = useRef(null);
  /** @type {React.MutableRefObject<{ px: number; py: number; tx0: number; ty0: number } | null>} */
  const panRef = useRef(null);
  const adjustRef = useRef(adjust);
  const lastTapRef = useRef(0);
  const movedRef = useRef(false);

  useEffect(() => {
    adjustRef.current = adjust;
  }, [adjust]);

  const transform = `translate(${adjust.tx}%, ${adjust.ty}%) rotate(${adjust.rotate}deg) scale(${adjust.scale})`;
  const box = RESIZE_SHEET_VIEWPORT_BOX[slotId];

  const onPointerDown = useCallback((/** @type {React.PointerEvent} */ e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = viewportRef.current;
    if (!el) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const n = pointersRef.current.size;
    if (n === 1) {
      movedRef.current = false;
      panRef.current = {
        px: e.clientX,
        py: e.clientY,
        tx0: adjustRef.current.tx,
        ty0: adjustRef.current.ty,
      };
      pinchRef.current = null;
    } else if (n >= 2) {
      const d = pinchDistance(pointersRef.current);
      pinchRef.current = {
        dist0: Math.max(d, 0.5),
        scale0: adjustRef.current.scale,
      };
      panRef.current = null;
    }
  }, []);

  const onPointerMove = useCallback((/** @type {React.PointerEvent} */ e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const n = pointersRef.current.size;
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect?.width) return;

    if (n >= 2 && pinchRef.current) {
      movedRef.current = true;
      const d = pinchDistance(pointersRef.current);
      const { dist0, scale0 } = pinchRef.current;
      if (dist0 > 0.5) {
        const ratio = Math.pow(d / dist0, PINCH_ZOOM_EXPONENT);
        onAdjust((a) => ({ ...a, scale: clampScale(scale0 * ratio) }));
      }
    } else if (n === 1) {
      const pan = panRef.current;
      if (!pan) return;
      const dx = e.clientX - pan.px;
      const dy = e.clientY - pan.py;
      if (!movedRef.current && Math.hypot(dx, dy) > 4) {
        movedRef.current = true;
      }
      const dtx = (dx / rect.width) * 110;
      const dty = (dy / rect.height) * 110;
      const { tx0, ty0 } = pan;
      onAdjust((a) => ({
        ...a,
        tx: clampPan(tx0 + dtx),
        ty: clampPan(ty0 + dty),
      }));
    }
  }, [onAdjust]);

  const handlePointerEnd = useCallback(
    (/** @type {React.PointerEvent} */ e) => {
      const el = viewportRef.current;
      pointersRef.current.delete(e.pointerId);
      try {
        el?.releasePointerCapture(e.pointerId);
      } catch (_) {
        /* noop */
      }
      const n = pointersRef.current.size;
      if (n === 1) {
        const [, p] = [...pointersRef.current.entries()][0];
        panRef.current = {
          px: p.x,
          py: p.y,
          tx0: adjustRef.current.tx,
          ty0: adjustRef.current.ty,
        };
        pinchRef.current = null;
        return;
      }
      if (n > 1) return;
      panRef.current = null;
      pinchRef.current = null;

      if (!movedRef.current) {
        const now = Date.now();
        if (now - lastTapRef.current < 320) {
          onAdjust(() => defaultSlotAdjust());
          lastTapRef.current = 0;
        } else {
          lastTapRef.current = now;
        }
      }
      movedRef.current = false;
    },
    [onAdjust],
  );

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (/** @type {WheelEvent} */ ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const lineMode = ev.deltaMode === 1;
      const pageMode = ev.deltaMode === 2;
      const norm = lineMode
        ? ev.deltaY * 16
        : pageMode
          ? ev.deltaY * 100
          : ev.deltaY;
      const clamped = Math.max(-120, Math.min(120, norm));
      const factor = Math.exp(-clamped * WHEEL_ZOOM_GAIN);
      onAdjust((a) => ({ ...a, scale: clampScale(a.scale * factor) }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onAdjust]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const blockScroll = (/** @type {TouchEvent} */ ev) => {
      if (ev.cancelable) ev.preventDefault();
    };
    el.addEventListener('touchmove', blockScroll, { passive: false });
    return () => el.removeEventListener('touchmove', blockScroll);
  }, []);

  const root =
    typeof document !== 'undefined' ? document.body : null;
  if (!root) return null;

  return createPortal(
    <>
      <div
        className="s1demo-resizeSheet__backdrop"
        role="presentation"
        aria-hidden
        onClick={onCancel}
      />
      <div
        className="s1demo-resizeSheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="s1demo-resizeSheet-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="s1demo-resizeSheet__handle" aria-hidden />
        <h2 id="s1demo-resizeSheet-title" className="s1demo-resizeSheet__title">
          {SLOT_LABEL[slotId]} — adjust
        </h2>
        <p className="s1demo-resizeSheet__subtitle">
          Pinch · drag · shapes above show live preview
        </p>
        <div
          ref={viewportRef}
          className="s1demo-resizeSheet__viewport"
          style={{ aspectRatio: `${box.w} / ${box.h}` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onLostPointerCapture={handlePointerEnd}
        >
          <img
            className="s1demo-resizeSheet__img"
            src={imageSrc}
            alt=""
            draggable={false}
            style={{ objectFit: adjust.fit, transform }}
          />
        </div>
        <div className="s1demo-resizeSheet__actions s1demo-editBar__actions">
          <button
            type="button"
            className="s1demo-editBar__btn s1demo-editBar__btn--ghost"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="s1demo-editBar__btn s1demo-editBar__btn--ghost"
            onClick={onReplace}
          >
            Replace
          </button>
          <button
            type="button"
            className="s1demo-editBar__btn s1demo-editBar__btn--danger"
            onClick={onRemove}
          >
            Remove
          </button>
          <button
            type="button"
            className="s1demo-editBar__btn s1demo-editBar__btn--ghost"
            onClick={onReset}
          >
            Reset
          </button>
          <button
            type="button"
            className="s1demo-editBar__btn s1demo-editBar__btn--toggle"
            onClick={onToggleFit}
            aria-pressed={adjust.fit === 'cover'}
          >
            Fit:&nbsp;
            <strong>{adjust.fit === 'cover' ? 'Cover' : 'Contain'}</strong>
          </button>
          <button
            type="button"
            className="s1demo-editBar__btn s1demo-editBar__btn--primary"
            onClick={onUpload}
          >
            Upload
          </button>
        </div>
      </div>
    </>,
    root,
  );
}

/**
 * Inline image slot.
 *  - Empty: tap opens file picker via click handler (reliable on iOS).
 *  - In edit mode: the bottom resize sheet owns pinch/drag/wheel — this slot
 *    mirrors the shared `adjust` state under the real curve masks as
 *    `s1demo-slot--sheetPreview` so fit vs. curve stays honest on-device.
 *  - Committed (post-upload): the image is locked — taps and gestures are
 *    no-ops. Hold ~520ms on the image and lift to replace (picker opens on
 *    pointer-up so iOS/Android keep user activation).
 *
 * While the bottom resize sheet is open, gestures happen there only; the
 * active slot keeps curve mask clipping as a live preview (`slotGesturesEnabled={false}`).
 *
 * `isEditing` selects edit styling on the slot. `disabled` is true when another
 * slot is being adjusted so locked slots ignore input.
 *
 * @param {{
 *   slotId: S1DemoSlotId;
 *   className: string;
 *   ariaLabel: string;
 *   hintEmpty: string;
 *   src: string;
 *   adjust: S1DemoSlotAdjust;
 *   isEditing: boolean;
 *   disabled: boolean;
 *   slotGesturesEnabled: boolean;
 *   disableDoubleTapReset?: boolean;
 *   suppressDoubleClickPicker?: boolean;
 *   openSlotPicker: (slot: S1DemoSlotId) => void;
 *   onAdjust: (slot: S1DemoSlotId, updater: (a: S1DemoSlotAdjust) => S1DemoSlotAdjust) => void;
 * }} props
 */
function S1DemoImageSlot({
  slotId,
  className,
  ariaLabel,
  hintEmpty,
  src,
  adjust,
  isEditing,
  disabled,
  slotGesturesEnabled,
  disableDoubleTapReset = false,
  suppressDoubleClickPicker = false,
  openSlotPicker,
  onAdjust,
}) {
  const elRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const pointersRef = useRef(new Map());
  /** @type {React.MutableRefObject<{ dist0: number; scale0: number } | null>} */
  const pinchRef = useRef(null);
  /** @type {React.MutableRefObject<{ px: number; py: number; tx0: number; ty0: number } | null>} */
  const panRef = useRef(null);
  const adjustRef = useRef(adjust);
  const movedRef = useRef(false);
  const lastTapRef = useRef(0);
  /** When the current gesture started (`pointerdown` of first finger), for long-press replace. */
  const gestureStartMsRef = useRef(0);
  /** True once two+ fingers touched this slot during the gesture (no long-press replace). */
  const hadMultiFingerRef = useRef(false);

  useEffect(() => {
    adjustRef.current = adjust;
  }, [adjust]);

  const transform = `translate(${adjust.tx}%, ${adjust.ty}%) rotate(${adjust.rotate}deg) scale(${adjust.scale})`;

  const onPointerDown = useCallback(
    (/** @type {React.PointerEvent} */ e) => {
      if (disabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const el = elRef.current;
      if (!el) return;
      // Pointer-capture only when there's an image (something to manipulate).
      // Empty slots rely on `onClick` to open the picker (see handlePointerEnd).
      if (!src) return;
      if (isEditing && !slotGesturesEnabled) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      movedRef.current = false;

      const n = pointersRef.current.size;
      if (n === 1) {
        gestureStartMsRef.current = Date.now();
      }
      if (n >= 2) {
        hadMultiFingerRef.current = true;
      }

      if (n >= 2) {
        const d = pinchDistance(pointersRef.current);
        pinchRef.current = {
          dist0: Math.max(d, 0.5),
          scale0: adjustRef.current.scale,
        };
        panRef.current = null;
      } else {
        panRef.current = {
          px: e.clientX,
          py: e.clientY,
          tx0: adjustRef.current.tx,
          ty0: adjustRef.current.ty,
        };
        pinchRef.current = null;
      }
    },
    [disabled, isEditing, slotGesturesEnabled, src],
  );

  const onPointerMove = useCallback(
    (/** @type {React.PointerEvent} */ e) => {
      if (disabled) return;
      if (isEditing && !slotGesturesEnabled) return;
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const n = pointersRef.current.size;
      const rect = elRef.current?.getBoundingClientRect();
      if (!rect?.width) return;

      if (n >= 2 && pinchRef.current) {
        movedRef.current = true;
        hadMultiFingerRef.current = true;
        // Zoom is only allowed *during* an edit session — after Upload commits
        // the slot is frozen, so pinching does nothing here.
        if (!isEditing) return;
        const d = pinchDistance(pointersRef.current);
        const { dist0, scale0 } = pinchRef.current;
        if (dist0 > 0.5) {
          const ratio = Math.pow(d / dist0, PINCH_ZOOM_EXPONENT);
          const s = scale0 * ratio;
          onAdjust(slotId, (a) => ({ ...a, scale: clampScale(s) }));
        }
      } else if (n === 1) {
        const pan = panRef.current;
        if (!pan) return;
        const dx = e.clientX - pan.px;
        const dy = e.clientY - pan.py;
        if (!movedRef.current && Math.hypot(dx, dy) > 4) {
          movedRef.current = true;
        }
        // Pan locked once the upload is committed (same rule as zoom above).
        if (!isEditing) return;
        const dtx = (dx / rect.width) * 110;
        const dty = (dy / rect.height) * 110;
        const { tx0, ty0 } = pan;
        onAdjust(slotId, (a) => ({
          ...a,
          tx: clampPan(tx0 + dtx),
          ty: clampPan(ty0 + dty),
        }));
      }
    },
    [disabled, isEditing, slotGesturesEnabled, slotId, onAdjust],
  );

  const handlePointerEnd = useCallback(
    (/** @type {React.PointerEvent} */ e) => {
      if (disabled) return;
      const el = elRef.current;
      // `onPointerDown` bails without tracking (e.g. sheet-preview slots) — ignore
      // `pointerup` or we treat `gestureStartMsRef` as 0 and wrongly open the picker.
      const hadPointer = pointersRef.current.has(e.pointerId);
      if (hadPointer) {
        pointersRef.current.delete(e.pointerId);
      }
      try {
        el?.releasePointerCapture(e.pointerId);
      } catch (_) {
        /* noop */
      }
      if (!hadPointer) {
        return;
      }

      const n = pointersRef.current.size;
      if (n === 1) {
        const [, p] = [...pointersRef.current.entries()][0];
        panRef.current = {
          px: p.x,
          py: p.y,
          tx0: adjustRef.current.tx,
          ty0: adjustRef.current.ty,
        };
        pinchRef.current = null;
        return;
      }
      if (n > 1) return;
      // n === 0: gesture finished
      panRef.current = null;
      pinchRef.current = null;

      const gesturesOn = !(isEditing && !slotGesturesEnabled);

      const replacedByLongPress =
        gesturesOn &&
        src &&
        !movedRef.current &&
        !hadMultiFingerRef.current &&
        gestureStartMsRef.current > 0 &&
        Date.now() - gestureStartMsRef.current >= LONG_PRESS_REPLACE_MS;

      if (!movedRef.current && gesturesOn) {
        if (replacedByLongPress) {
          // Synchronous `input.click()` on pointer up keeps iOS / Android happy.
          lastTapRef.current = 0;
          openSlotPicker(slotId);
        } else if (isEditing && src && !disableDoubleTapReset) {
          // Short tap while editing (with image): double-tap resets adjust.
          const now = Date.now();
          if (now - lastTapRef.current < 320) {
            onAdjust(slotId, () => defaultSlotAdjust());
            lastTapRef.current = 0;
          } else {
            lastTapRef.current = now;
          }
        }
        // Empty slots: picker opens via `onClick` (not pointerup) so iOS does
        // not get a double-invocation from synthetic click vs pointer gesture.
      }

      hadMultiFingerRef.current = false;
      gestureStartMsRef.current = 0;
      movedRef.current = false;
    },
    [
      disabled,
      disableDoubleTapReset,
      isEditing,
      slotGesturesEnabled,
      src,
      slotId,
      onAdjust,
      openSlotPicker,
    ],
  );

  useEffect(() => {
    const el = elRef.current;
    // Wheel zoom only attaches while the slot is in edit mode; a committed
    // slot ignores wheel scrolling entirely so the page can scroll normally.
    if (
      !el ||
      !src ||
      disabled ||
      !isEditing ||
      !slotGesturesEnabled
    )
      return;
    const onWheel = (/** @type {WheelEvent} */ ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      // Multiplicative step so the zoom feels equally fast whether the user
      // is at 0.5× or 5×. Trackpad pixels and mouse-wheel "lines" both report
      // very different deltaY magnitudes — we normalise via deltaMode + a
      // capped per-event delta so a single hard scroll doesn't snap to max zoom.
      const lineMode = ev.deltaMode === 1; // DOM_DELTA_LINE
      const pageMode = ev.deltaMode === 2; // DOM_DELTA_PAGE
      const norm = lineMode
        ? ev.deltaY * 16
        : pageMode
          ? ev.deltaY * 100
          : ev.deltaY;
      const clamped = Math.max(-120, Math.min(120, norm));
      const factor = Math.exp(-clamped * WHEEL_ZOOM_GAIN);
      onAdjust(slotId, (a) => ({ ...a, scale: clampScale(a.scale * factor) }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [disabled, isEditing, slotGesturesEnabled, src, slotId, onAdjust]);

  /** iOS / WebKit: `touch-action: none` alone is not always enough; block
   * default touch scrolling on the slot while editing so pinch-zoom isn't
   * stolen by the page. */
  useEffect(() => {
    const el = elRef.current;
    if (
      !el ||
      !src ||
      disabled ||
      !isEditing ||
      !slotGesturesEnabled
    )
      return;
    const blockScroll = (/** @type {TouchEvent} */ ev) => {
      if (ev.cancelable) ev.preventDefault();
    };
    el.addEventListener('touchmove', blockScroll, { passive: false });
    return () => el.removeEventListener('touchmove', blockScroll);
  }, [disabled, isEditing, slotGesturesEnabled, src]);

  const cls = [
    's1demo-slot',
    className,
    // Grab cursor + touch-action: none only while gestures run on-slot.
    isEditing && !disabled && slotGesturesEnabled
      ? 's1demo-slot--interactive'
      : '',
    isEditing && slotGesturesEnabled ? 's1demo-slot--editing' : '',
    isEditing && !slotGesturesEnabled ? 's1demo-slot--sheetPreview' : '',
    src && !isEditing && !disabled ? 's1demo-slot--committed' : '',
    disabled ? 's1demo-slot--locked' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={elRef}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      className={cls}
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onClick={(e) => {
        if (disabled) return;
        // Mobile Safari: relying on pointerup opens the picker poorly and can stack
        // two requests; synthetic `click` after tap is what keeps user activation coherent.
        if (!src) {
          if (suppressDoubleClickPicker && e.detail > 1) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          openSlotPicker(slotId);
        }
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          // Empty slot → open the picker. Committed slots are intentionally
          // inert (the upload is locked); use long-press to replace.
          if (!src) openSlotPicker(slotId);
        }
      }}
    >
      {src ? (
        <div className="s1demo-slot__imgLayer">
          <img
            src={src}
            alt=""
            draggable={false}
            style={{ objectFit: adjust.fit, transform }}
          />
        </div>
      ) : (
        <span className="s1demo-slot__hint">{hintEmpty}</span>
      )}
    </div>
  );
}

function Screen1DemoImage() {
  const navigate = useNavigate();
  const calendarEvents = useCalendarEvents();
  const {
    selectSlider,
    setSelectSlider,
    setBallAtRight,
    setIsTimer,
    isTimer,
  } = useContext(AppContext);

  const fileInputRef = useRef(null);
  const pendingSlotRef = useRef(/** @type {S1DemoSlotId} */ ('hero'));
  /** Same-slot duplicate `click()` within one gesture (mainly iOS). */
  const lastPickerOpenRef = useRef(
    /** @type {{ t: number; slot: S1DemoSlotId | null }} */ ({ t: 0, slot: null }),
  );
  /** One `sessionStorage` read per mount so both `useState` initializers stay in sync. */
  const s1PersistedMountRef = useRef(
    /** @type {S1PersistedShape | null | undefined} */ (undefined),
  );
  if (s1PersistedMountRef.current === undefined) {
    s1PersistedMountRef.current = readS1DemoPersisted();
  }
  const [demoImages, setDemoImages] = useState(
    () => s1PersistedMountRef.current?.images ?? initialDemoImages(),
  );
  const [demoAdjust, setDemoAdjust] = useState(
    () => s1PersistedMountRef.current?.adjust ?? initialDemoAdjust(),
  );

  useEffect(() => {
    persistS1Demo(demoImages, demoAdjust);
  }, [demoImages, demoAdjust]);

  /** Slot currently in adjust-before-upload mode (null = nothing pending). */
  const [editingSlot, setEditingSlot] = useState(
    /** @type {S1DemoSlotId | null} */ (null),
  );
  /**
   * Snapshot taken when entering edit mode. If the user cancels, we revert
   * to this so unconfirmed pinch / drag / new image is discarded.
   * @type {[ { src: string; adjust: S1DemoSlotAdjust } | null, Function ]}
   */
  const [editSnapshot, setEditSnapshot] = useState(
    /** @type {{ src: string; adjust: S1DemoSlotAdjust } | null} */ (null),
  );

  /**
   * Enter edit mode for a slot. Optional overrides set the working image / adjust
   * (used when the picker just produced a new file). The pre-edit state is
   * snapshot-ed so Cancel can restore it.
   */
  const enterEditMode = useCallback(
    (
      /** @type {S1DemoSlotId} */ slot,
      /** @type {string | undefined} */ srcOverride,
      /** @type {S1DemoSlotAdjust | undefined} */ adjustOverride,
    ) => {
      setEditSnapshot({
        src: demoImages[slot] || '',
        adjust: { ...demoAdjust[slot] },
      });
      if (srcOverride !== undefined) {
        setDemoImages((prev) => ({ ...prev, [slot]: srcOverride }));
      }
      if (adjustOverride !== undefined) {
        setDemoAdjust((prev) => ({ ...prev, [slot]: adjustOverride }));
      }
      setEditingSlot(slot);
    },
    [demoImages, demoAdjust],
  );

  const confirmEdit = useCallback(() => {
    setEditingSlot(null);
    setEditSnapshot(null);
  }, []);

  const cancelEdit = useCallback(() => {
    if (editingSlot && editSnapshot) {
      const { src, adjust } = editSnapshot;
      setDemoImages((prev) => ({ ...prev, [editingSlot]: src }));
      setDemoAdjust((prev) => ({ ...prev, [editingSlot]: adjust }));
    }
    setEditingSlot(null);
    setEditSnapshot(null);
  }, [editingSlot, editSnapshot]);

  const resetEditAdjust = useCallback(() => {
    if (!editingSlot) return;
    setDemoAdjust((prev) => ({
      ...prev,
      [editingSlot]: defaultSlotAdjust(),
    }));
  }, [editingSlot]);

  /**
   * Flip the active slot between `contain` (full upload visible, possibly
   * letterboxed) and `cover` (image fills slot, edges cropped). Pan/zoom is
   * preserved across the toggle.
   */
  const toggleFit = useCallback(() => {
    if (!editingSlot) return;
    setDemoAdjust((prev) => ({
      ...prev,
      [editingSlot]: {
        ...prev[editingSlot],
        fit: prev[editingSlot].fit === 'cover' ? 'contain' : 'cover',
      },
    }));
  }, [editingSlot]);

  const openSlotPicker = useCallback((/** @type {S1DemoSlotId} */ slot) => {
    const now = Date.now();
    const prev = lastPickerOpenRef.current;
    if (prev.slot === slot && now - prev.t < 320) return;
    lastPickerOpenRef.current = { t: now, slot };
    pendingSlotRef.current = slot;
    fileInputRef.current?.click();
  }, []);

  /** Clear image and exit edit (slot becomes empty — no Cancel snapshot restore). */
  const removeWhileEditing = useCallback(() => {
    const slot = editingSlot;
    if (!slot) return;
    setDemoImages((prev) => ({ ...prev, [slot]: '' }));
    setDemoAdjust((prev) => ({ ...prev, [slot]: defaultSlotAdjust() }));
    setEditingSlot(null);
    setEditSnapshot(null);
  }, [editingSlot]);

  /** From the bottom bar — real tap keeps iOS happy for `input.click()`. */
  const replaceWhileEditing = useCallback(() => {
    if (!editingSlot) return;
    openSlotPicker(editingSlot);
  }, [editingSlot, openSlotPicker]);
  const handleAdjust = useCallback(
    (
      /** @type {S1DemoSlotId} */ slot,
      /** @type {(a: S1DemoSlotAdjust) => S1DemoSlotAdjust} */ updater,
    ) => {
      setDemoAdjust((prev) => {
        const next = updater(prev[slot]);
        return {
          ...prev,
          [slot]: {
            ...next,
            scale: clampScale(next.scale),
            tx: clampPan(next.tx),
            ty: clampPan(next.ty),
            rotate: Math.min(180, Math.max(-180, next.rotate)),
          },
        };
      });
    },
    [],
  );

  const onDemoFileChange = useCallback(
    (e) => {
      const input = /** @type {HTMLInputElement} */ (e.target);
      const file = input.files?.[0];
      const slot = pendingSlotRef.current;

      if (!isChosenImageFile(file)) {
        resetFileInputLater(input);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        enterEditMode(slot, String(reader.result), defaultSlotAdjust());
        resetFileInputLater(input);
      };
      reader.onerror = () => {
        resetFileInputLater(input);
      };
      reader.readAsDataURL(/** @type {Blob} */ (file));
    },
    [enterEditMode],
  );

  // Esc cancels an in-progress edit.
  useEffect(() => {
    if (!editingSlot) return;
    const onKey = (/** @type {KeyboardEvent} */ ev) => {
      if (ev.key === 'Escape') cancelEdit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingSlot, cancelEdit]);

  const showProfileAgain = () => {
    setSelectSlider(false);
    setBallAtRight(false);
    setIsTimer(false);
  };

  const toolbarApt = useMemo(() => {
    const session = readPersistedScreen2Apt();
    if (session) return session;
    const today = new Date();
    const todays = calendarEvents
      .filter((ev) => isSameLocalDay(ev.start, today))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    return todays.length ? buildAptNavPayload(todays[0]) : null;
  }, [calendarEvents]);

  /** Active slot image URL while resize bottom sheet is open (slots other than curve strip). */
  const sheetEditingSlot = editingSlot;
  const sheetImageSrc =
    sheetEditingSlot && demoImages[sheetEditingSlot]
      ? demoImages[sheetEditingSlot]
      : '';

  return (
    <div className="screen1-container screen1-container--demoImage">
      <input
        ref={fileInputRef}
        type="file"
        className="s1demo-fileInput"
        accept="image/*,.heic,.heif,.jpg,.jpeg,.png,.webp,.gif"
        aria-label="Choose image for demo placeholder"
        tabIndex={-1}
        onChange={onDemoFileChange}
      />
      <div className="date-screen1">
        <DynamicDate />
      </div>
      <div id="screen1-modal-root" className="screen1-modal-root" />

      <div className="layout-wrapper">
        <div className="screen1-background">
          {selectSlider ? (
            <button
              type="button"
              className="screen1-profilePeek"
              onClick={showProfileAgain}
              aria-label="Show profile and muse slider"
            >
              <CaretRight size={22} weight="bold" aria-hidden />
            </button>
          ) : null}
          <div>
            <div
              className="profile-panel s1demo-panelSlot"
              style={{
                transform: selectSlider ? 'translateX(-100%)' : 'translateX(0)',
              }}
            >
              <div className="s1demo-grayStack">
                <S1DemoImageSlot
                  slotId="topBar"
                  className="s1demo-grayStack__topBar s1demo-slot--compact"
                  ariaLabel="Top bar: tap to add image, then resize before uploading"
                  hintEmpty="Tap"
                  src={demoImages.topBar}
                  adjust={demoAdjust.topBar}
                  isEditing={editingSlot === 'topBar'}
                  disabled={editingSlot != null && editingSlot !== 'topBar'}
                  slotGesturesEnabled={editingSlot !== 'topBar'}
                  openSlotPicker={openSlotPicker}
                  onAdjust={handleAdjust}
                />
                <S1DemoImageSlot
                  slotId="hero"
                  className="s1demo-grayStack__hero"
                  ariaLabel="Hero: tap to add image, then resize before uploading"
                  hintEmpty="Tap to add image"
                  src={demoImages.hero}
                  adjust={demoAdjust.hero}
                  isEditing={editingSlot === 'hero'}
                  disabled={editingSlot != null && editingSlot !== 'hero'}
                  slotGesturesEnabled={editingSlot !== 'hero'}
                  openSlotPicker={openSlotPicker}
                  onAdjust={handleAdjust}
                />
              </div>
            </div>

            <S1DemoImageSlot
              slotId="promo"
              className="s1demo-grayPromo s1demo-slot--promo"
              ariaLabel="Promo: tap to add image, then resize before uploading"
              hintEmpty="Tap"
              src={demoImages.promo}
              adjust={demoAdjust.promo}
              isEditing={editingSlot === 'promo'}
              disabled={editingSlot != null && editingSlot !== 'promo'}
              slotGesturesEnabled={editingSlot !== 'promo'}
              openSlotPicker={openSlotPicker}
              onAdjust={handleAdjust}
            />
            <div
              className="client-list-wrapper client-list"
              style={{
                transform: isTimer ? 'translateX(-100%)' : 'translateX(0%)',
              }}
            >
              <ClientList stylistFromPath={S1_DEMO_IMAGE_ROUTE} />
              <WaitingList />
            </div>
            <div
              className="timer-panel"
              style={{
                transform: isTimer ? 'translateX(0%)' : 'translateX(-100%)',
              }}
            >
              <SetTimmer />
            </div>
            <div className="screen1-toolbar" role="toolbar" aria-label="Screen toolbar">
              {SCREEN_DEMO_TOOLBAR.map(({ Icon, label, to }, i) => {
                const isActive = i === SCREEN_DEMO_ACTIVE;
                return (
                  <button
                    key={label}
                    type="button"
                    className={`screen1-toolbar__btn${isActive ? ' screen1-toolbar__btn--solid' : ''}`}
                    aria-label={label}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => {
                      if (to === '/clients') {
                        navigate(to, { state: { from: S1_DEMO_IMAGE_ROUTE } });
                        return;
                      }
                      navigate(
                        to,
                        toolbarApt && (to === '/screen2' || to === '/climax')
                          ? {
                              state: {
                                apt: toolbarApt,
                                ...(to === '/climax'
                                  ? { from: S1_DEMO_IMAGE_ROUTE }
                                  : {}),
                              },
                            }
                          : undefined,
                      );
                    }}
                  >
                    <Icon
                      size={isActive ? 26 : 24}
                      weight={isActive ? 'fill' : 'regular'}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="curvedline-container curvedline-container--demoSlot">
            <div className="s1demo-curveStripLayer">
              <S1DemoImageSlot
                slotId="curveStrip"
                className="s1demo-curveStripSlot"
                ariaLabel="Right of curve line: tap to add or edit image"
                hintEmpty="Tap"
                src={demoImages.curveStrip}
                adjust={demoAdjust.curveStrip}
                isEditing={editingSlot === 'curveStrip'}
                disabled={editingSlot != null && editingSlot !== 'curveStrip'}
                slotGesturesEnabled={editingSlot === 'curveStrip'}
                disableDoubleTapReset
                suppressDoubleClickPicker
                openSlotPicker={openSlotPicker}
                onAdjust={handleAdjust}
              />
            </div>
            <CurvedLine hideBodyFill={!!demoImages.curveStrip} />
          </div>
        </div>
      </div>

      <div className="screen1-blackBelow" aria-hidden />

      {editingSlot === 'curveStrip' ? (
        <div
          className="s1demo-editBar"
          role="dialog"
          aria-modal="false"
          aria-label="Curve strip image: replace, remove, upload"
        >
          <span className="s1demo-editBar__hint" aria-hidden>
            Pinch · drag on strip · bar below
          </span>
          <div className="s1demo-editBar__actions">
            <button
              type="button"
              className="s1demo-editBar__btn s1demo-editBar__btn--ghost"
              onClick={cancelEdit}
            >
              Cancel
            </button>
            <button
              type="button"
              className="s1demo-editBar__btn s1demo-editBar__btn--ghost"
              onClick={replaceWhileEditing}
            >
              Replace
            </button>
            <button
              type="button"
              className="s1demo-editBar__btn s1demo-editBar__btn--danger"
              onClick={removeWhileEditing}
            >
              Remove
            </button>
            <button
              type="button"
              className="s1demo-editBar__btn s1demo-editBar__btn--ghost"
              onClick={resetEditAdjust}
            >
              Reset
            </button>
            <button
              type="button"
              className="s1demo-editBar__btn s1demo-editBar__btn--toggle"
              onClick={toggleFit}
              aria-pressed={demoAdjust.curveStrip.fit === 'cover'}
            >
              Fit:&nbsp;
              <strong>
                {demoAdjust.curveStrip.fit === 'cover' ? 'Cover' : 'Contain'}
              </strong>
            </button>
            <button
              type="button"
              className="s1demo-editBar__btn s1demo-editBar__btn--primary"
              onClick={confirmEdit}
            >
              Upload
            </button>
          </div>
        </div>
      ) : null}

      {sheetEditingSlot &&
      sheetImageSrc &&
      sheetEditingSlot !== 'curveStrip' ? (
        <S1DemoResizeBottomSheet
          slotId={sheetEditingSlot}
          imageSrc={sheetImageSrc}
          adjust={demoAdjust[sheetEditingSlot]}
          onAdjust={(fn) => handleAdjust(sheetEditingSlot, fn)}
          onCancel={cancelEdit}
          onUpload={confirmEdit}
          onReplace={replaceWhileEditing}
          onRemove={removeWhileEditing}
          onReset={resetEditAdjust}
          onToggleFit={toggleFit}
        />
      ) : null}
    </div>
  );
}

export default Screen1DemoImage;
