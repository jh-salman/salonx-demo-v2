import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import MicrositeShell from '../MicrositeShell'
import { micrositeApi, micrositePublicPath } from '../micrositeApi'
import { useMicrositeSlug } from '../useMicrositeSlug'

export default function MicrositeSuccess() {
  const slug = useMicrositeSlug()
  const location = useLocation()
  const [salon, setSalon] = useState(null)
  const name = location.state?.clientName || 'You'

  useEffect(() => {
    if (!slug) return
    micrositeApi.getPublicSalon(slug).then((d) => setSalon(d.salon)).catch(() => {})
  }, [slug])

  const shellSalon = salon || {
    name: 'Salon',
    slug,
    primaryHex: '#3b82f6',
    templateId: 'sx-book-v1',
  }

  return (
    <MicrositeShell salon={shellSalon}>
      <div className="ms-center ms-success">
        <h1>You&apos;re booked</h1>
        <p className="ms-muted">
          {name}, we saved your appointment
          {salon?.name ? ` at ${salon.name}` : ''}.
        </p>
        <Link className="ms-btn ms-btn--primary" to={micrositePublicPath(slug)}>
          Done
        </Link>
      </div>
    </MicrositeShell>
  )
}
