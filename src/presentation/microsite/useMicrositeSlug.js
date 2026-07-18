import { useParams } from 'react-router-dom'
import { getHostMicrositeSlug } from './micrositeApi'

/** Slug from `/m/:slug` (preview) or from `{slug}.salonx.com` host. */
export function useMicrositeSlug() {
  const { slug: paramSlug } = useParams()
  if (paramSlug) return String(paramSlug).toLowerCase()
  return getHostMicrositeSlug()
}
