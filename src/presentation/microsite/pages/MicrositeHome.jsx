import { useEffect, useState } from 'react'
import MicrositeShell from '../MicrositeShell'
import MicrositeHero from '../components/MicrositeHero'
import { micrositeApi } from '../micrositeApi'
import { useMicrositeSlug } from '../useMicrositeSlug'

export default function MicrositeHome() {
  const slug = useMicrositeSlug()
  const [salon, setSalon] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) {
      setError('Salon not found')
      return
    }
    let alive = true
    micrositeApi
      .getPublicSalon(slug)
      .then((data) => {
        if (alive) setSalon(data.salon)
      })
      .catch((e) => {
        if (alive) setError(e.message || 'Salon not found')
      })
    return () => {
      alive = false
    }
  }, [slug])

  if (error) {
    return (
      <div className="ms-shell">
        <div className="ms-shell__inner ms-center">
          <h1>Unavailable</h1>
          <p className="ms-muted">{error}</p>
        </div>
      </div>
    )
  }

  if (!salon) {
    return (
      <div className="ms-shell">
        <div className="ms-shell__inner ms-center">
          <p className="ms-muted">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <MicrositeShell salon={salon} landing>
      <MicrositeHero salon={salon} />
    </MicrositeShell>
  )
}
