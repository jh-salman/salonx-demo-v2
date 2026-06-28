import { getV2AdminCachedConfig } from '../sync/v2AdminBootstrap.js'
import {
  DEFAULT_CAPTION,
  DEFAULT_CHIPS,
  DEFAULT_TAGS,
  POST_TYPES,
  BG_PRESETS,
} from '../presentation/ramp/rampData.js'

let cachedPresets = null

function getActiveBrandFromWindow() {
  const body = getV2AdminCachedConfig()
  if (!body || typeof body !== 'object') return null
  const brands = body.brands
  if (!Array.isArray(brands) || brands.length === 0) return null
  const activeId =
    typeof body.activeBrandId === 'string' ? body.activeBrandId.trim() : ''
  if (activeId) {
    const match = brands.find((b) => b && b.id === activeId)
    if (match) return match
  }
  return brands[0] || null
}

export function getRampBrandPresets() {
  if (cachedPresets) return cachedPresets
  const brand = getActiveBrandFromWindow()
  const ramp = brand?.ramp && typeof brand.ramp === 'object' ? brand.ramp : null

  cachedPresets = {
    caption:
      typeof ramp?.defaultCaption === 'string' && ramp.defaultCaption.trim()
        ? ramp.defaultCaption
        : DEFAULT_CAPTION,
    postTypes:
      Array.isArray(ramp?.postTypes) && ramp.postTypes.length > 0
        ? ramp.postTypes.filter((x) => typeof x === 'string')
        : POST_TYPES,
    tags:
      Array.isArray(ramp?.defaultTags) && ramp.defaultTags.length > 0
        ? ramp.defaultTags.map((tag) => ({ ...tag }))
        : DEFAULT_TAGS.map((tag) => ({ ...tag })),
    chips:
      Array.isArray(ramp?.defaultChips) && ramp.defaultChips.length > 0
        ? ramp.defaultChips.map((chip) => ({ ...chip }))
        : DEFAULT_CHIPS.map((chip) => ({ ...chip })),
    links:
      Array.isArray(ramp?.defaultLinks) && ramp.defaultLinks.length > 0
        ? ramp.defaultLinks.map((link) => ({ ...link }))
        : [{ id: 'l1', url: 'https://dangerjonescreative.com/', inherited: true }],
    backgrounds:
      Array.isArray(ramp?.backgrounds) && ramp.backgrounds.length > 0
        ? ramp.backgrounds
        : BG_PRESETS,
  }
  return cachedPresets
}

export function clearRampBrandPresetsCache() {
  cachedPresets = null
}

if (typeof window !== 'undefined') {
  window.addEventListener('salonx:v2admin-theme', () => {
    clearRampBrandPresetsCache()
  })
}
