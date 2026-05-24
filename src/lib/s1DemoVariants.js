/** @typedef {'topBar' | 'hero' | 'promo' | 'curveStrip'} S1DemoSlotId */

export const MAX_S1_SLOT_VARIANTS = 3;

/** @typedef {{ scale: number; rotate: number; tx: number; ty: number; fit: 'cover' | 'contain' }} S1DemoSlotAdjust */
/** @typedef {'image' | 'video'} S1DemoSlotMediaKind */
/** @typedef {{ id: string; url: string; kind: S1DemoSlotMediaKind; adjust: S1DemoSlotAdjust }} S1DemoSlotVariantItem */
/** @typedef {{ activeIndex: number; items: S1DemoSlotVariantItem[] }} S1DemoSlotVariantSet */

const S1_SLOTS = /** @type {S1DemoSlotId[]} */ ([
  'topBar',
  'hero',
  'promo',
  'curveStrip',
]);

/** @param {unknown} v @returns {v is S1DemoSlotAdjust} */
function isSlotAdjust(v) {
  if (!v || typeof v !== 'object') return false;
  const o = /** @type {Record<string, unknown>} */ (v);
  return (
    typeof o.scale === 'number' &&
    typeof o.rotate === 'number' &&
    typeof o.tx === 'number' &&
    typeof o.ty === 'number' &&
    (o.fit === 'cover' || o.fit === 'contain')
  );
}

/** @param {S1DemoSlotAdjust} a */
function clampAdjust(a) {
  return {
    scale: Math.min(60, Math.max(0.35, a.scale)),
    rotate: Math.min(180, Math.max(-180, a.rotate)),
    tx: Math.min(50, Math.max(-50, a.tx)),
    ty: Math.min(50, Math.max(-50, a.ty)),
    fit: a.fit,
  };
}

function clampActiveIndex(index, len) {
  if (len <= 0) return 0;
  const n = Math.floor(index);
  if (!Number.isFinite(n)) return 0;
  return Math.min(len - 1, Math.max(0, n));
}

/** @param {string} url @returns {S1DemoSlotMediaKind} */
function inferKindFromUrl(url) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url.trim()) ? 'video' : 'image';
}

/** @param {unknown} raw @returns {S1DemoSlotVariantItem | null} */
function normalizeVariantItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const url = typeof o.url === 'string' ? o.url.trim() : '';
  if (!url) return null;
  const id =
    typeof o.id === 'string' && o.id.trim()
      ? o.id.trim()
      : `v_${Date.now().toString(36)}`;
  const kind =
    o.kind === 'video' ? 'video' : o.kind === 'image' ? 'image' : inferKindFromUrl(url);
  const adjust = isSlotAdjust(o.adjust)
    ? clampAdjust(o.adjust)
    : clampAdjust({ scale: 1, rotate: 0, tx: 0, ty: 0, fit: 'contain' });
  return { id, url, kind, adjust };
}

/** @param {unknown} raw @returns {S1DemoSlotVariantSet | null} */
export function normalizeVariantSet(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const itemsIn = Array.isArray(o.items) ? o.items : [];
  /** @type {S1DemoSlotVariantItem[]} */
  const items = [];
  for (const entry of itemsIn) {
    const item = normalizeVariantItem(entry);
    if (!item) continue;
    if (items.some((x) => x.url === item.url)) continue;
    items.push(item);
    if (items.length >= MAX_S1_SLOT_VARIANTS) break;
  }
  if (items.length === 0) return null;
  const activeIndex = clampActiveIndex(
    typeof o.activeIndex === 'number' ? o.activeIndex : 0,
    items.length,
  );
  return { activeIndex, items };
}

/** @param {unknown} variantsRaw @returns {Partial<Record<S1DemoSlotId, S1DemoSlotVariantSet>> | undefined} */
export function normalizeS1DemoVariantsField(variantsRaw) {
  if (!variantsRaw || typeof variantsRaw !== 'object') return undefined;
  /** @type {Partial<Record<S1DemoSlotId, S1DemoSlotVariantSet>>} */
  const out = {};
  for (const slot of S1_SLOTS) {
    const set = normalizeVariantSet(/** @type {Record<string, unknown>} */ (variantsRaw)[slot]);
    if (set) out[slot] = set;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * @param {{
 *   images: Record<S1DemoSlotId, string>;
 *   adjust: Record<S1DemoSlotId, S1DemoSlotAdjust>;
 *   mediaKinds?: Partial<Record<S1DemoSlotId, S1DemoSlotMediaKind>>;
 *   variants?: Partial<Record<S1DemoSlotId, S1DemoSlotVariantSet>>;
 * }} s1Demo
 */
export function syncLegacyFromActiveVariants(s1Demo) {
  if (!s1Demo.variants) return s1Demo;
  const next = {
    ...s1Demo,
    images: { ...s1Demo.images },
    adjust: { ...s1Demo.adjust },
    mediaKinds: { ...(s1Demo.mediaKinds ?? {}) },
    variants: { ...s1Demo.variants },
  };
  for (const slot of S1_SLOTS) {
    const set = next.variants?.[slot];
    if (!set?.items?.length) continue;
    const idx = clampActiveIndex(set.activeIndex, set.items.length);
    const item = set.items[idx];
    if (!item) continue;
    next.images[slot] = item.url;
    next.adjust[slot] = clampAdjust(item.adjust);
    next.mediaKinds = { ...next.mediaKinds, [slot]: item.kind };
    next.variants = { ...next.variants, [slot]: { ...set, activeIndex: idx } };
  }
  return next;
}

/**
 * @param {{
 *   variants?: Partial<Record<S1DemoSlotId, S1DemoSlotVariantSet>>;
 * }} s1Demo
 * @param {S1DemoSlotId} slot
 * @returns {S1DemoSlotVariantSet | null}
 */
export function getSlotVariantSet(s1Demo, slot) {
  const set = s1Demo.variants?.[slot];
  if (!set?.items?.length) return null;
  const activeIndex = clampActiveIndex(set.activeIndex, set.items.length);
  return { ...set, activeIndex };
}

/**
 * @param {{
 *   images: Record<S1DemoSlotId, string>;
 *   adjust: Record<S1DemoSlotId, S1DemoSlotAdjust>;
 *   mediaKinds?: Partial<Record<S1DemoSlotId, S1DemoSlotMediaKind>>;
 *   variants?: Partial<Record<S1DemoSlotId, S1DemoSlotVariantSet>>;
 * }} s1Demo
 * @param {S1DemoSlotId} slot
 * @param {number} delta
 */
export function cycleSlotVariant(s1Demo, slot, delta = 1) {
  const set = getSlotVariantSet(s1Demo, slot);
  if (!set || set.items.length <= 1) return s1Demo;
  const len = set.items.length;
  const nextIndex = (set.activeIndex + delta + len * 8) % len;
  const variants = {
    ...(s1Demo.variants ?? {}),
    [slot]: { ...set, activeIndex: nextIndex },
  };
  return syncLegacyFromActiveVariants({ ...s1Demo, variants });
}

/**
 * @param {{
 *   images: Record<S1DemoSlotId, string>;
 *   adjust: Record<S1DemoSlotId, S1DemoSlotAdjust>;
 *   mediaKinds?: Partial<Record<S1DemoSlotId, S1DemoSlotMediaKind>>;
 *   variants?: Partial<Record<S1DemoSlotId, S1DemoSlotVariantSet>>;
 * }} s1Demo
 * @param {S1DemoSlotId} slot
 * @param {number} index
 */
export function activateSlotVariant(s1Demo, slot, index) {
  const set = getSlotVariantSet(s1Demo, slot);
  if (!set) return s1Demo;
  const activeIndex = clampActiveIndex(index, set.items.length);
  const variants = { ...(s1Demo.variants ?? {}), [slot]: { ...set, activeIndex } };
  return syncLegacyFromActiveVariants({ ...s1Demo, variants });
}

/** @param {unknown} raw @returns {Partial<Record<S1DemoSlotId, S1DemoSlotVariantSet>> | undefined} */
export function readVariantsFromPersisted(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const variantsRaw = /** @type {Record<string, unknown>} */ (raw).variants;
  return normalizeS1DemoVariantsField(variantsRaw);
}
