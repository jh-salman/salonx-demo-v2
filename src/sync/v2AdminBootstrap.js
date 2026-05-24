import {
  PRIMARY_STORAGE_KEY,
  applySalonxPrimaryTheme,
  normalizePrimaryHex,
  readStoredPrimaryHex,
} from '../theme/primaryTheme.js'

const S1_SESSION_KEY = '@salonx/s1-demo-image/v1'
/** Marquee / login hero (`Screen0`) — Build Station "Marquee" (`s2`). */
export const MARQUEE_SESSION_KEY = '@salonx/s2-marquee/v1'
/** Climax inlay — Build Station "Climax" (`s4`). */
export const CLIMAX_BG_SESSION_KEY = '@salonx/s4-climax/v1'
const V2_ACTIVE_BRAND_KEY = '@salonx/v2admin-active-brand'
/** Last published marker from admin (`webProjectionAt`) — bumps on Apply to App. */
const CONFIG_REV_KEY = '@salonx/v2admin-config-rev'
const V2_CONFIG_CACHE_KEY = '@salonx/v2admin-config-cache/v1'

const S1_IMAGE_URL_SLOTS = ['hero', 'promo', 'curveStrip']

/** @returns {Record<string, { scale: number; rotate: number; tx: number; ty: number; fit: 'cover' | 'contain' }>} */
function defaultS1AdjustRecord() {
  const slot = () => ({
    scale: 1,
    rotate: 0,
    tx: 0,
    ty: 0,
    fit: /** @type {'contain'} */ ('contain'),
  })
  return {
    topBar: slot(),
    hero: slot(),
    promo: slot(),
    curveStrip: slot(),
  }
}

function mergeS1AdjustFromConfig(cfg) {
  const base = defaultS1AdjustRecord()
  const ad =
    cfg.s1Demo &&
    typeof cfg.s1Demo === 'object' &&
    cfg.s1Demo.adjust &&
    typeof cfg.s1Demo.adjust === 'object'
      ? cfg.s1Demo.adjust
      : {}
  for (const slot of ['topBar', 'hero', 'promo', 'curveStrip']) {
    const a = ad[slot]
    if (!a || typeof a !== 'object') continue
    base[slot] = {
      scale:
        typeof a.scale === 'number'
          ? Math.min(60, Math.max(0.35, a.scale))
          : base[slot].scale,
      rotate:
        typeof a.rotate === 'number'
          ? Math.min(180, Math.max(-180, a.rotate))
          : 0,
      tx:
        typeof a.tx === 'number'
          ? Math.min(50, Math.max(-50, a.tx))
          : 0,
      ty:
        typeof a.ty === 'number'
          ? Math.min(50, Math.max(-50, a.ty))
          : 0,
      fit: a.fit === 'cover' || a.fit === 'contain' ? a.fit : 'contain',
    }
  }
  return base
}

function mergeS1MediaKindsFromConfig(cfg) {
  const base = {
    topBar: /** @type {'image'} */ ('image'),
    hero: /** @type {'image'} */ ('image'),
    promo: /** @type {'image'} */ ('image'),
    curveStrip: /** @type {'image'} */ ('image'),
  }
  const mk =
    cfg.s1Demo &&
    typeof cfg.s1Demo === 'object' &&
    cfg.s1Demo.mediaKinds &&
    typeof cfg.s1Demo.mediaKinds === 'object'
      ? cfg.s1Demo.mediaKinds
      : {}
  for (const slot of ['topBar', 'hero', 'promo', 'curveStrip']) {
    const v = mk[slot]
    if (v === 'video') base[slot] = 'video'
  }
  return base
}

function mergeS1VariantsFromConfig(cfg) {
  const raw =
    cfg.s1Demo &&
    typeof cfg.s1Demo === 'object' &&
    cfg.s1Demo.variants &&
    typeof cfg.s1Demo.variants === 'object'
      ? cfg.s1Demo.variants
      : null
  if (!raw) return undefined
  /** @type {Record<string, { activeIndex: number; items: unknown[] }>} */
  const out = {}
  for (const slot of ['topBar', 'hero', 'promo', 'curveStrip']) {
    const set = raw[slot]
    if (!set || typeof set !== 'object' || !Array.isArray(set.items)) continue
    if (set.items.length === 0) continue
    out[slot] = {
      activeIndex: typeof set.activeIndex === 'number' ? set.activeIndex : 0,
      items: set.items,
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function hasS1SessionPayload() {
  if (typeof sessionStorage === 'undefined') return false
  try {
    return Boolean(sessionStorage.getItem(S1_SESSION_KEY))
  } catch {
    return false
  }
}

function hasMarqueeSessionPayload() {
  if (typeof sessionStorage === 'undefined') return false
  try {
    return Boolean(sessionStorage.getItem(MARQUEE_SESSION_KEY))
  } catch {
    return false
  }
}

function hasClimaxSessionPayload() {
  if (typeof sessionStorage === 'undefined') return false
  try {
    return Boolean(sessionStorage.getItem(CLIMAX_BG_SESSION_KEY))
  } catch {
    return false
  }
}

function isDevDemoApi() {
  return (
    import.meta.env.DEV &&
    String(import.meta.env.VITE_DEV_USE_DEMO_API || '').toLowerCase() === 'true'
  )
}

/**
 * Base URL for v2-admin / demo-api APIs (no trailing slash).
 * Production: `VITE_V2_ADMIN_URL` if set, else same-origin `/salonx-admin` (see `vercel.json`).
 * Development:
 * - `VITE_DEV_USE_DEMO_API=true` → `/salonx-demo-api` (Vite proxy → demo-api, default :4000).
 * - Else `/salonx-admin` (Vite proxy → local Next); `VITE_V2_ADMIN_URL` ignored unless
 *   `VITE_DEV_USE_REMOTE_V2_ADMIN=true`.
 * Runtime override: `window.__SALONX_V2_ADMIN_URL__`.
 */
export function getV2AdminBase() {
  if (typeof window !== 'undefined' && window.__SALONX_V2_ADMIN_URL__) {
    const w = String(window.__SALONX_V2_ADMIN_URL__).trim().replace(/\/$/, '')
    if (w) return w
  }
  if (isDevDemoApi()) {
    return '/salonx-demo-api'
  }
  const fromEnv =
    typeof import.meta.env.VITE_V2_ADMIN_URL === 'string'
      ? import.meta.env.VITE_V2_ADMIN_URL.trim().replace(/\/$/, '')
      : ''
  const useRemoteInDev =
    import.meta.env.DEV &&
    String(import.meta.env.VITE_DEV_USE_REMOTE_V2_ADMIN || '').toLowerCase() === 'true'
  if (fromEnv && (!import.meta.env.DEV || useRemoteInDev)) {
    return fromEnv
  }
  return '/salonx-admin'
}

let warnedMissingV2AdminUrl = false
function warnIfNoV2AdminBase() {
  if (warnedMissingV2AdminUrl) return
  warnedMissingV2AdminUrl = true
  if (typeof window !== 'undefined' && window.__SALONX_V2_ADMIN_URL__) return
  if (isDevDemoApi()) {
    console.info(
      '[salonx-web-v2] Dev: API uses /salonx-demo-api → demo-api (see vite.config.js). Override VITE_DEMO_API_PROXY_TARGET if not http://localhost:4000.',
    )
    return
  }
  const fromEnv =
    typeof import.meta.env.VITE_V2_ADMIN_URL === 'string' &&
    import.meta.env.VITE_V2_ADMIN_URL.trim() !== ''
  const useRemoteInDev =
    import.meta.env.DEV &&
    String(import.meta.env.VITE_DEV_USE_REMOTE_V2_ADMIN || '').toLowerCase() === 'true'
  if (import.meta.env.DEV && fromEnv && !useRemoteInDev) {
    console.info(
      '[salonx-web-v2] Dev: API uses /salonx-admin (local v2-admin). VITE_V2_ADMIN_URL is ignored so appointments match local DATABASE_URL. Set VITE_DEV_USE_REMOTE_V2_ADMIN=true to use the remote URL.',
    )
    return
  }
  if (import.meta.env.DEV && !fromEnv) {
    console.info(
      '[salonx-web-v2] Using /salonx-admin (proxy to local v2-admin). Override with window.__SALONX_V2_ADMIN_URL__.',
    )
  }
}

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
 */
function parseSlotAdjustField(a, defaultFit) {
  const src = a && typeof a === 'object' ? a : {}
  return {
    scale: clampMarqueeScale(src.scale),
    tx: clampMarqueePan(src.tx),
    ty: clampMarqueePan(src.ty),
    rotate: Math.min(
      180,
      Math.max(-180, typeof src.rotate === 'number' ? src.rotate : 0),
    ),
    fit:
      src.fit === 'contain' || src.fit === 'cover' ? src.fit : defaultFit,
  }
}

function parseSimpleScreenJson(raw, defaultFit) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const image = typeof parsed.image === 'string' ? parsed.image : ''
    const mediaKind = parsed.mediaKind === 'video' ? 'video' : 'image'
    const adjust = parseSlotAdjustField(parsed.adjust, defaultFit)
    const headerLogo =
      typeof parsed.headerLogo === 'string' ? parsed.headerLogo : ''
    const headerLogoAdjust = parseSlotAdjustField(
      parsed.headerLogoAdjust,
      'contain',
    )
    return { image, adjust, mediaKind, headerLogo, headerLogoAdjust }
  } catch {
    return null
  }
}

export function readMarqueePersisted() {
  if (typeof sessionStorage === 'undefined') return null
  return parseSimpleScreenJson(
    sessionStorage.getItem(MARQUEE_SESSION_KEY),
    'cover',
  )
}

export function readClimaxBgPersisted() {
  if (typeof sessionStorage === 'undefined') return null
  return parseSimpleScreenJson(
    sessionStorage.getItem(CLIMAX_BG_SESSION_KEY),
    'cover',
  )
}

/** @param {unknown} s4 */
function buildClimaxSessionPayload(s4) {
  const block =
    s4 && typeof s4 === 'object' ? s4 : { image: '', adjust: {} }
  const s4Adj =
    block.adjust && typeof block.adjust === 'object' ? block.adjust : {}
  const s4HeaderAdj =
    block.headerLogoAdjust && typeof block.headerLogoAdjust === 'object'
      ? block.headerLogoAdjust
      : {}
  return {
    image: typeof block.image === 'string' ? block.image : '',
    adjust: s4Adj,
    headerLogo: typeof block.headerLogo === 'string' ? block.headerLogo : '',
    headerLogoAdjust: s4HeaderAdj,
  }
}

/** Compare published s4 to session so header-logo-only updates still apply. */
function climaxBrandDiffersFromPersistedSession(s4) {
  const expected = buildClimaxSessionPayload(s4)
  const expectedNorm = {
    image: expected.image.trim(),
    headerLogo: expected.headerLogo.trim(),
    adjust: parseSlotAdjustField(expected.adjust, 'cover'),
    headerLogoAdjust: parseSlotAdjustField(
      expected.headerLogoAdjust,
      'contain',
    ),
  }
  const persisted = readClimaxBgPersisted()
  if (!persisted) {
    return Boolean(expectedNorm.image || expectedNorm.headerLogo)
  }
  const actualNorm = {
    image: (persisted.image || '').trim(),
    headerLogo: (persisted.headerLogo || '').trim(),
    adjust: parseSlotAdjustField(persisted.adjust, 'cover'),
    headerLogoAdjust: parseSlotAdjustField(
      persisted.headerLogoAdjust,
      'contain',
    ),
  }
  return JSON.stringify(expectedNorm) !== JSON.stringify(actualNorm)
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
  const s4HeaderLogo =
    activeBrand &&
    activeBrand.s4 &&
    typeof activeBrand.s4 === 'object' &&
    typeof activeBrand.s4.headerLogo === 'string'
      ? activeBrand.s4.headerLogo.trim()
      : ''
  const hasS4Image = Boolean(s4Img)
  const hasS4HeaderLogo = Boolean(s4HeaderLogo)

  let marqueeSessionMissing = false
  try {
    marqueeSessionMissing =
      Boolean(activeBrand) && !sessionStorage.getItem(MARQUEE_SESSION_KEY)
  } catch {
    marqueeSessionMissing = Boolean(activeBrand)
  }

  let climaxSessionMissing = false
  try {
    climaxSessionMissing =
      Boolean(activeBrand) && !sessionStorage.getItem(CLIMAX_BG_SESSION_KEY)
  } catch {
    climaxSessionMissing = Boolean(activeBrand)
  }

  if (typeof cfg.primaryHex === 'string') {
    const hex = normalizePrimaryHex(cfg.primaryHex)
    const prev = readStoredPrimaryHex()
    if (hex !== prev) {
      try {
        localStorage.setItem(PRIMARY_STORAGE_KEY, hex)
      } catch {
        /* */
      }
      applySalonxPrimaryTheme(hex)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('salonx:v2admin-theme'))
      }
    }
  }

  const needsS1Hydration = hasS1Images && !hasS1SessionPayload()
  const needsMarqueeHydration = hasS2Image && !hasMarqueeSessionPayload()
  const needsClimaxHydration =
    (hasS4Image || hasS4HeaderLogo) && !hasClimaxSessionPayload()

  const s4FromActiveBrand =
    activeBrand?.s4 && typeof activeBrand.s4 === 'object'
      ? activeBrand.s4
      : null
  const climaxMediaOutOfSync = Boolean(
    s4FromActiveBrand && climaxBrandDiffersFromPersistedSession(s4FromActiveBrand),
  )

  const shouldApplyProjectedMedia =
    revisionAdvanced ||
    marqueeSessionMissing ||
    climaxSessionMissing ||
    climaxMediaOutOfSync ||
    needsS1Hydration ||
    needsMarqueeHydration ||
    needsClimaxHydration ||
    (!hasServerRevision &&
      (brandChanged || hasS1Images || hasS2Image || hasS4Image || hasS4HeaderLogo))

  if (!shouldApplyProjectedMedia) return

  const s1Ready =
    cfg.s1Demo &&
    typeof cfg.s1Demo === 'object' &&
    cfg.s1Demo.images &&
    s1HasAnyImageUrl(cfg.s1Demo.images)

  try {
    if (s1Ready) {
      const imgs =
        cfg.s1Demo.images && typeof cfg.s1Demo.images === 'object'
          ? { ...cfg.s1Demo.images, topBar: '' }
          : cfg.s1Demo.images
      const variants = mergeS1VariantsFromConfig(cfg)
      const payload = {
        images: imgs,
        adjust: mergeS1AdjustFromConfig(cfg),
        mediaKinds: mergeS1MediaKindsFromConfig(cfg),
      }
      if (variants) payload.variants = variants
      sessionStorage.setItem(S1_SESSION_KEY, JSON.stringify(payload))
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

      const s4Payload = buildClimaxSessionPayload(
        activeBrand.s4 && typeof activeBrand.s4 === 'object'
          ? activeBrand.s4
          : { image: '', adjust: {} },
      )
      sessionStorage.setItem(
        CLIMAX_BG_SESSION_KEY,
        JSON.stringify(s4Payload),
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

function readV2ConfigCache() {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(V2_CONFIG_CACHE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (!o || typeof o !== 'object' || !o.body || typeof o.body !== 'object')
      return null
    const etag = typeof o.etag === 'string' ? o.etag.trim() : ''
    return { etag, body: o.body }
  } catch {
    return null
  }
}

function writeV2ConfigCache(etag, body) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(
      V2_CONFIG_CACHE_KEY,
      JSON.stringify({ etag: etag || '', body, savedAt: Date.now() }),
    )
  } catch {
    /* */
  }
}

export function applyCachedV2AdminConfigFromStorage() {
  const c = readV2ConfigCache()
  if (c?.body) applyV2AdminConfigJson(c.body)
}

export async function syncFromV2Admin() {
  warnIfNoV2AdminBase()
  const base = getV2AdminBase()
  if (!base) return false

  try {
    const cached = readV2ConfigCache()
    const headers = {}
    if (cached?.etag) headers['If-None-Match'] = cached.etag

    const sameOrigin = base.startsWith('/')
    const res = await fetch(`${base}/api/config?forWeb=1`, {
      mode: sameOrigin ? 'same-origin' : 'cors',
      cache: 'no-store',
      headers,
    })
    if (res.status === 304) {
      if (cached?.body) applyV2AdminConfigJson(cached.body)
      return true
    }
    if (!res.ok) return false

    const cfg = await res.json()
    applyV2AdminConfigJson(cfg)
    const etag = res.headers.get('ETag')?.trim() || ''
    writeV2ConfigCache(etag, cfg)
    return true
  } catch {
    return false
  }
}

const POLL_MS_PROXIED = 400
const POLL_MS_SSE_BACKUP = 8000

export function startV2AdminRealtimeSync() {
  warnIfNoV2AdminBase()
  const base = getV2AdminBase()
  if (!base) return () => {}

  const proxied = base.startsWith('/')
  const pollMs = proxied ? POLL_MS_PROXIED : POLL_MS_SSE_BACKUP

  const pollId = setInterval(() => {
    void syncFromV2Admin()
  }, pollMs)

  /** Same-origin SSE: full-URL admin, or dev proxy to demo-api (`/salonx-demo-api`). Skip for `/salonx-admin` → Next (proxy buffering). */
  const useEventSource =
    typeof EventSource !== 'undefined' &&
    (!proxied || base.startsWith('/salonx-demo-api'))

  let es
  if (useEventSource) {
    try {
      es = new EventSource(`${base}/api/config/stream?forWeb=1`)
      es.onmessage = (ev) => {
        try {
          const cfg = JSON.parse(ev.data)
          applyV2AdminConfigJson(cfg)
          writeV2ConfigCache('', cfg)
        } catch {
          /* */
        }
      }
    } catch {
      es = undefined
    }
  }

  const bump = () => {
    void syncFromV2Admin()
  }
  const onVis = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      bump()
    }
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', bump)
    document.addEventListener('visibilitychange', onVis)
  }

  return () => {
    clearInterval(pollId)
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', bump)
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVis)
    }
    try {
      es?.close()
    } catch {
      /* */
    }
  }
}
