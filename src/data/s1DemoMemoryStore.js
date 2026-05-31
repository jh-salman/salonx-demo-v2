/**
 * In-memory S1 demo payload — source of truth is server config (DB).
 * No sessionStorage / localStorage for S1 media.
 */

/** @type {Record<string, unknown> | null} */
let s1DemoPayload = null

/** @returns {Record<string, unknown> | null} */
export function getS1DemoMemoryPayload() {
  return s1DemoPayload
}

/** @param {Record<string, unknown> | null | undefined} payload */
export function setS1DemoMemoryPayload(payload) {
  if (!payload || typeof payload !== 'object') return
  s1DemoPayload = payload
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('salonx:v2admin-s1demo'))
  }
}

export function clearS1DemoMemory() {
  s1DemoPayload = null
}

export function hasS1DemoMemoryPayload() {
  return Boolean(s1DemoPayload)
}

export function s1DemoMemoryFingerprint() {
  if (!s1DemoPayload) return ''
  try {
    return JSON.stringify({
      images: s1DemoPayload.images,
      adjust: s1DemoPayload.adjust,
      mediaKinds: s1DemoPayload.mediaKinds,
      variants: s1DemoPayload.variants,
    })
  } catch {
    return ''
  }
}

/** @param {Record<string, unknown>} expected */
export function s1DemoMemoryDiffersFrom(expected) {
  if (!expected || typeof expected !== 'object') return false
  if (!s1DemoPayload) return true
  try {
    const expectedFp = JSON.stringify({
      images: expected.images,
      adjust: expected.adjust,
      mediaKinds: expected.mediaKinds,
      variants: expected.variants,
    })
    return expectedFp !== s1DemoMemoryFingerprint()
  } catch {
    return true
  }
}
