/** Microsite landing theme helpers — mirrors demo-api microsite.theme.ts */

export const DEFAULT_MICROSITE_THEME = {
  fontHeading: 'Instrument Serif',
  fontBody: 'DM Sans',
  heroImageUrl: null,
  heroTitle: 'Book Your Appointment',
  heroSubtitle: 'How to schedule your visit and find our salon.',
  ctaLabel: 'Book Your Appointment',
  bgHex: '#0a0a0b',
  surfaceHex: '#141416',
  textHex: '#f4f4f5',
  mutedHex: '#a1a1aa',
}

export const MICROSITE_FONT_HEADINGS = [
  'Instrument Serif',
  'Playfair Display',
  'Cormorant Garamond',
  'DM Serif Display',
  'Libre Baskerville',
  'system',
]

export const MICROSITE_FONT_BODIES = [
  'DM Sans',
  'Manrope',
  'Source Sans 3',
  'Inter',
  'system',
]

const GOOGLE_FAMILIES = {
  'Instrument Serif': 'Instrument+Serif:ital@0;1',
  'Playfair Display': 'Playfair+Display:ital,wght@0,500;0,600;1,500',
  'Cormorant Garamond': 'Cormorant+Garamond:ital,wght@0,500;0,600;1,500',
  'DM Serif Display': 'DM+Serif+Display:ital@0;1',
  'Libre Baskerville': 'Libre+Baskerville:ital,wght@0,400;0,700;1,400',
  'DM Sans': 'DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400',
  Manrope: 'Manrope:wght@400;500;600;700',
  'Source Sans 3': 'Source+Sans+3:ital,wght@0,400;0,600;1,400',
  Inter: 'Inter:wght@400;500;600;700',
}

function asHex(v, fallback) {
  const s = typeof v === 'string' ? v.trim() : ''
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : fallback
}

export function normalizeMicrositeTheme(raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const heroImageUrl =
    typeof o.heroImageUrl === 'string' ? o.heroImageUrl.trim() : ''
  return {
    fontHeading:
      (typeof o.fontHeading === 'string' && o.fontHeading.trim()) ||
      DEFAULT_MICROSITE_THEME.fontHeading,
    fontBody:
      (typeof o.fontBody === 'string' && o.fontBody.trim()) ||
      DEFAULT_MICROSITE_THEME.fontBody,
    heroImageUrl: heroImageUrl || null,
    heroTitle:
      (typeof o.heroTitle === 'string' && o.heroTitle.trim()) ||
      DEFAULT_MICROSITE_THEME.heroTitle,
    heroSubtitle:
      (typeof o.heroSubtitle === 'string' && o.heroSubtitle.trim()) ||
      DEFAULT_MICROSITE_THEME.heroSubtitle,
    ctaLabel:
      (typeof o.ctaLabel === 'string' && o.ctaLabel.trim()) ||
      DEFAULT_MICROSITE_THEME.ctaLabel,
    bgHex: asHex(o.bgHex, DEFAULT_MICROSITE_THEME.bgHex),
    surfaceHex: asHex(o.surfaceHex, DEFAULT_MICROSITE_THEME.surfaceHex),
    textHex: asHex(o.textHex, DEFAULT_MICROSITE_THEME.textHex),
    mutedHex: asHex(o.mutedHex, DEFAULT_MICROSITE_THEME.mutedHex),
  }
}

export function fontStack(name) {
  if (!name || name === 'system') {
    return 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif'
  }
  return `"${name}", ui-sans-serif, system-ui, sans-serif`
}

export function googleFontsHref(theme) {
  const t = normalizeMicrositeTheme(theme)
  const ids = [t.fontHeading, t.fontBody]
    .map((n) => GOOGLE_FAMILIES[n])
    .filter(Boolean)
  if (!ids.length) return null
  return `https://fonts.googleapis.com/css2?${ids
    .map((f) => `family=${f}`)
    .join('&')}&display=swap`
}

export function micrositeThemeStyle(salon) {
  const theme = normalizeMicrositeTheme(salon?.theme)
  const primary = salon?.primaryHex || '#3b82f6'
  return {
    '--ms-primary': primary,
    '--ms-bg': theme.bgHex,
    '--ms-surface': theme.surfaceHex,
    '--ms-text': theme.textHex,
    '--ms-muted': theme.mutedHex,
    '--ms-font-heading': fontStack(theme.fontHeading),
    '--ms-font-body': fontStack(theme.fontBody),
  }
}

const FONT_LINK_ID = 'ms-google-fonts'

/** Ensure Google Fonts stylesheet for the active theme. */
export function ensureMicrositeFonts(theme) {
  if (typeof document === 'undefined') return
  const href = googleFontsHref(theme)
  const existing = document.getElementById(FONT_LINK_ID)
  if (!href) {
    existing?.remove()
    return
  }
  if (existing) {
    if (existing.getAttribute('href') !== href) existing.setAttribute('href', href)
    return
  }
  const link = document.createElement('link')
  link.id = FONT_LINK_ID
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}
