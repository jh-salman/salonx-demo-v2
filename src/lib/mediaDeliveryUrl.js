/**
 * Shrink bytes over the wire for phone-sized UI (Cloudinary only).
 * Other hosts (Vercel Blob, local /uploads) are unchanged — compress at upload or use a CDN rule there.
 *
 * @param {string} url
 * @param {'image' | 'video'} kind
 * @returns {string}
 */
export function optimizeMediaDeliveryUrl(url, kind) {
  const u = String(url || '').trim()
  if (!u || u.startsWith('data:')) return u

  const m = u.match(
    /^(https?:\/\/res\.cloudinary\.com\/[^/]+)\/(image|video)\/upload\/(.+)$/i,
  )
  if (!m) return u

  const [, origin, resourceType, rest] = m
  const firstSeg = rest.split('/')[0] || ''
  /** Already has transformation segment (not plain `v123` version or folder name). */
  if (segmentLooksLikeCloudinaryTransforms(firstSeg)) return u

  const rt = resourceType.toLowerCase()
  const transforms =
    rt === 'video'
      ? // Cap width + auto quality — huge originals otherwise buffer for minutes on 4G.
        'w_960,c_limit,q_auto:eco,f_mp4'
      : 'f_auto,q_auto:good,w_1200,c_limit'

  return `${origin}/${rt}/upload/${transforms}/${rest}`
}

/** @param {string} seg */
function segmentLooksLikeCloudinaryTransforms(seg) {
  if (!seg) return false
  if (seg.includes(',')) return true
  if (/^v\d+$/i.test(seg)) return false
  if (seg.includes('_')) return true
  return false
}
