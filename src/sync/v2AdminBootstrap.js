import {
  PRIMARY_STORAGE_KEY,
  applySalonxPrimaryTheme,
  normalizePrimaryHex,
  readStoredPrimaryHex,
} from '../theme/primaryTheme.js'

const S1_SESSION_KEY = '@salonx/s1-demo-image/v1'
/** Marquee / login hero (`Screen0`) — v2-admin Build Station tab "Marquee" (`s2`). */
export const MARQUEE_SESSION_KEY = '@salonx/s2-marquee/v1'
/** Climax checkout bg (`Climax.jsx` inlay) — Build Station tab "Climax" (`s4`). */
export const CLIMAX_BG_SESSION_KEY = '@salonx/s4-climax/v1'
/** Tracks v2-admin `activeBrandId` so Stylist media swaps when admin activates another brand. */
const V2_ACTIVE_BRAND_KEY = '@salonx/v2admin-active-brand'
/** v2-admin `webProjectionAt` / publish marker — advances only on Apply to App (and explicit publish). */
const CONFIG_REV_KEY = '@salonx/v2admin-config-rev'

/** Slots that can carry images (top bar is fixed SVG in app — ignore URLs). */
const S1_IMAGE_URL_SLOTS = ['hero', 'promo', 'curveStrip']

let warnedMissingV2AdminUrl = false
function warnIfNoV2AdminBase() {
  if (warnedMissingV2AdminUrl) return
  const base = import.meta.env.VITE_V2_ADMIN_URL?.trim?.()
  if (base) return
  warnedMissingV2AdminUrl = true
  if (import.meta.env.DEV) {
    console.warn(
      '[salonx-web-v2] VITE_V2_ADMIN_URL is unset — Marquee, Climax, and Stylist screens will not sync from the admin panel. Add it to .env (e.g. http://localhost:3000).',
    )
  }
}

/** @param {unknown} images */
function s1HasAnyImageUrl(images) {
  if (!images || typeof images !== 'object') return false
  return S1_IMAGE_URL_SLOTS.some(
    (k) => typeof images[k] === 'string' && images[k].trim() !== '',
  )
}

/** @param {unknown} cfg */
function getActiveBrandFromConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return null
  const brands = cfg.brands
  if (!Array.isArray(brands) || brands.length === 0) return null
  const id =
    typeof cfg.activeBrandId === 'string' ? cfg.activeBrandId.trim() : ''
  if (id) {
    const b = brands.find((x) => x && typeof x === 'object' && x.id === id)
    if (b) return b
  }
  const first = brands[0]
  return first && typeof first === 'object' ? first : null
}

function clampMarqueeScale(s) {
  return Math.min(60, Math.max(0.35, typeof s === 'number' ? s : 1))
}

function clampMarqueePan(n) {
  return Math.min(50, Math.max(-50, typeof n === 'number' ? n : 0))
}

/**
 * @param {string | null} raw
 * @param {'cover' | 'contain'} defaultFit
 * @returns {{ image: string; mediaKind?: 'image' | 'video'; adjust: { scale: number; rotate: number; tx: number; ty: number; fit: 'cover' | 'contain' } } | null}
 */
function parseSimpleScreenJson(raw, defaultFit) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const image = typeof parsed.image === 'string' ? parsed.image : ''
    const mediaKind = parsed.mediaKind === 'video' ? 'video' : 'image'
    const a =
      parsed.adjust && typeof parsed.adjust === 'object' ? parsed.adjust : {}
    const adjust = {
      scale: clampMarqueeScale(a.scale),
      tx: clampMarqueePan(a.tx),
      ty: clampMarqueePan(a.ty),
      rotate: Math.min(
        180,
        Math.max(-180, typeof a.rotate === 'number' ? a.rotate : 0),
      ),
      fit:
        a.fit === 'contain' || a.fit === 'cover' ? a.fit : defaultFit,
    }
    return { image, adjust, mediaKind }
  } catch {
    return null
  }
}

/** Normalized marquee payload for `Screen0`. */
export function readMarqueePersisted() {
  if (typeof sessionStorage === 'undefined') return null
  return parseSimpleScreenJson(
    sessionStorage.getItem(MARQUEE_SESSION_KEY),
    'cover',
  )
}

/** Normalized Climax inlay image + adjust for `Climax.jsx`. */
export function readClimaxBgPersisted() {
  if (typeof sessionStorage === 'undefined') return null
  return parseSimpleScreenJson(
    sessionStorage.getItem(CLIMAX_BG_SESSION_KEY),
    'cover',
  )
}

/** @param {unknown} cfg */
export function applyV2AdminConfigJson(cfg) {
  if (!cfg || typeof cfg !== 'object') return

  const meta =
    cfg._meta && typeof cfg._meta === 'object' ? cfg._meta : null
  const revRaw =
    meta && meta.configRevision != null
      ? String(meta.configRevision).trim()
      : ''
  const hasServerRevision = revRaw !== ''

  let prevRev = ''
  try {
    prevRev = sessionStorage.getItem(CONFIG_REV_KEY) || ''
  } catch {
    /* */
  }

  const revisionAdvanced = hasServerRevision && revRaw !== prevRev

  const activeId =
    typeof cfg.activeBrandId === 'string' ? cfg.activeBrandId.trim() : ''
  let prevActiveId = ''
  try {
    prevActiveId = sessionStorage.getItem(V2_ACTIVE_BRAND_KEY) || ''
  } catch {
    /* */
  }

  const brandChanged = Boolean(activeId && activeId !== prevActiveId)
  const hasS1Images =
    cfg.s1Demo &&
    typeof cfg.s1Demo === 'object' &&
    cfg.s1Demo.images &&
    s1HasAnyImageUrl(cfg.s1Demo.images)

  const activeBrand = getActiveBrandFromConfig(cfg)
  const s2Img =
    activeBrand &&
    activeBrand.s2 &&
    typeof activeBrand.s2 === 'object' &&
    typeof activeBrand.s2.image === 'string'
      ? activeBrand.s2.image.trim()
      : ''
  const hasS2Image = Boolean(s2Img)

  const s4Img =
    activeBrand &&
    activeBrand.s4 &&
    typeof activeBrand.s4 === 'object' &&
    typeof activeBrand.s4.image === 'string'
      ? activeBrand.s4.image.trim()
      : ''
  const hasS4Image = Boolean(s4Img)

  /*
   * Theme follows the active brand projection whenever it differs from what we have —
   * not only when media sync runs (same revision + fresh load used to skip primaryHex).
   */
  if (typeof cfg.primaryHex === 'string') {
    const hex = normalizePrimaryHex(cfg.primaryHex)
    const prev = readStoredPrimaryHex()
    if (hex !== prev) {
      try {
        localStorage.setItem(PRIMARY_STORAGE_KEY, hex)
      } catch {
        /* quota / private mode */
      }
      applySalonxPrimaryTheme(hex)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('salonx:v2admin-theme'))
      }
    }
  }

  /*
   * - configRevision from API changed → admin saved (any field) → apply projected media.
   * - Legacy payloads without revision: brand switch, or any S1/S2/S4 image URL present.
   */
  const shouldApplyProjectedMedia =
    revisionAdvanced ||
    (!hasServerRevision &&
      (brandChanged || hasS1Images || hasS2Image || hasS4Image))

  if (!shouldApplyProjectedMedia) return

  const s1Ready =
    cfg.s1Demo &&
    typeof cfg.s1Demo === 'object' &&
    cfg.s1Demo.images &&
    cfg.s1Demo.adjust

  try {
    if (s1Ready) {
      const imgs =
        cfg.s1Demo.images && typeof cfg.s1Demo.images === 'object'
          ? { ...cfg.s1Demo.images, topBar: '' }
          : cfg.s1Demo.images
      sessionStorage.setItem(
        S1_SESSION_KEY,
        JSON.stringify({
          images: imgs,
          adjust: cfg.s1Demo.adjust,
        }),
      )
    }

    if (activeBrand) {
      const s2 =
        activeBrand.s2 && typeof activeBrand.s2 === 'object'
          ? activeBrand.s2
          : { image: '', adjust: {} }
      const adj =
        s2.adjust && typeof s2.adjust === 'object' ? s2.adjust : {}
      const s2Kind =
        s2.mediaKind === 'video' ? 'video' : 'image'
      sessionStorage.setItem(
        MARQUEE_SESSION_KEY,
        JSON.stringify({
          image: typeof s2.image === 'string' ? s2.image : '',
          adjust: adj,
          mediaKind: s2Kind,
        }),
      )

      const s4 =
        activeBrand.s4 && typeof activeBrand.s4 === 'object'
          ? activeBrand.s4
          : { image: '', adjust: {} }
      const s4Adj =
        s4.adjust && typeof s4.adjust === 'object' ? s4.adjust : {}
      sessionStorage.setItem(
        CLIMAX_BG_SESSION_KEY,
        JSON.stringify({
          image: typeof s4.image === 'string' ? s4.image : '',
          adjust: s4Adj,
        }),
      )
    }

    if (activeId) {
      sessionStorage.setItem(V2_ACTIVE_BRAND_KEY, activeId)
    }
    if (hasServerRevision) {
      sessionStorage.setItem(CONFIG_REV_KEY, revRaw)
    }
  } catch {
    /* quota */
  }

  if (typeof window !== 'undefined') {
    if (s1Ready) {
      window.dispatchEvent(new CustomEvent('salonx:v2admin-s1demo'))
    }
    if (activeBrand) {
      window.dispatchEvent(new CustomEvent('salonx:v2admin-marquee'))
      window.dispatchEvent(new CustomEvent('salonx:v2admin-climax'))
    }
  }
}

/**
 * Pull theme + Screen 1 demo media from v2-admin so any device/browser can stay in sync.
 * Set `VITE_V2_ADMIN_URL` (e.g. https://your-admin.vercel.app) in `.env` for salonx-web-v2.
 */
export async function syncFromV2Admin() {
  warnIfNoV2AdminBase()
  const base = import.meta.env.VITE_V2_ADMIN_URL?.trim?.()?.replace(/\/$/, '')
  if (!base) return false

  try {
    const res = await fetch(`${base}/api/config?forWeb=1`, {
      mode: 'cors',
      cache: 'no-store',
    })
    if (!res.ok) return false

    const cfg = await res.json()
    applyV2AdminConfigJson(cfg)
    return true
  } catch {
    return false
  }
}

/**
 * Subscribe to v2-admin config changes over SSE (`/api/config/stream`).
 * Returns a disposer; call on teardown (e.g. HMR) if needed.
 */
export function startV2AdminRealtimeSync() {
  warnIfNoV2AdminBase()
  const base = import.meta.env.VITE_V2_ADMIN_URL?.trim?.()?.replace(/\/$/, '')
  if (!base || typeof EventSource === 'undefined') return () => {}

  let es
  try {
    es = new EventSource(`${base}/api/config/stream?forWeb=1`)
    es.onmessage = (ev) => {
      try {
        const cfg = JSON.parse(ev.data)
        applyV2AdminConfigJson(cfg)
      } catch {
        /* */
      }
    }
  } catch {
    return () => {}
  }

  return () => {
    try {
      es?.close()
    } catch {
      /* */
    }
  }
}
