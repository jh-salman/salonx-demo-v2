/**
 * Read curve-strip media for `/screen1` from in-memory S1 demo store
 * (hydrated from server config / DB — no sessionStorage).
 */

import { getS1DemoMemoryPayload } from '../data/s1DemoMemoryStore.js';

function clampScale(s) {
  return Math.min(60, Math.max(0.35, s));
}
function clampPan(n) {
  return Math.min(50, Math.max(-50, n));
}

/** @returns {{ scale: number; rotate: number; tx: number; ty: number; fit: 'cover' | 'contain' }} */
function defaultCurveAdjust() {
  return {
    scale: 1,
    rotate: 0,
    tx: 0,
    ty: 0,
    fit: 'contain',
  };
}

/**
 * @returns {{ src: string; adjust: ReturnType<typeof defaultCurveAdjust>; isVideo: boolean } | null}
 */
export function readS1DemoCurveStripFromSession() {
  try {
    const parsed = getS1DemoMemoryPayload();
    if (!parsed || typeof parsed !== 'object') return null;
    const { images: im, adjust: ad, mediaKinds: mkRaw } = parsed;
    if (!im || typeof im !== 'object' || !ad || typeof ad !== 'object')
      return null;

    const src =
      typeof im.curveStrip === 'string' ? im.curveStrip.trim() : '';
    if (!src) return null;

    const base = defaultCurveAdjust();
    const a = ad.curveStrip;
    if (a && typeof a === 'object') {
      base.scale = clampScale(
        typeof a.scale === 'number' ? a.scale : base.scale,
      );
      base.tx = clampPan(typeof a.tx === 'number' ? a.tx : 0);
      base.ty = clampPan(typeof a.ty === 'number' ? a.ty : 0);
      base.rotate = Math.min(
        180,
        Math.max(-180, typeof a.rotate === 'number' ? a.rotate : 0),
      );
      base.fit = a.fit === 'contain' || a.fit === 'cover' ? a.fit : 'contain';
    }

    let isVideo = mkRaw && typeof mkRaw === 'object' && mkRaw.curveStrip === 'video';
    if (
      !isVideo &&
      /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(src)
    ) {
      isVideo = true;
    }

    return { src, adjust: base, isVideo };
  } catch {
    return null;
  }
}
