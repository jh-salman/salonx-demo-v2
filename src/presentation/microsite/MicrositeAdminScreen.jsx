import { useEffect, useState } from 'react'
import CreateFromTemplate from './admin/CreateFromTemplate'
import MicrositeThemeEditor from './admin/MicrositeThemeEditor'
import { micrositeApi } from './micrositeApi'
import './microsite.css'

/** Stylist-side panel: create from template, then edit theme. */
export default function MicrositeAdminScreen() {
  const [salon, setSalon] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function refresh() {
    setLoading(true)
    micrositeApi
      .listSalons()
      .then((d) => {
        const list = d.salons || []
        setSalon(list[0] || null)
      })
      .catch((e) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <div className="ms-shell ms-shell--admin">
      <div className="ms-shell__inner">
        <h1 className="ms-admin__page-title">Microsite</h1>
        {loading ? <p className="ms-muted">Loading…</p> : null}
        {error ? <p className="ms-error">{error}</p> : null}
        {!loading && !salon ? (
          <CreateFromTemplate onCreated={(s) => setSalon(s)} />
        ) : null}
        {!loading && salon ? (
          <MicrositeThemeEditor salon={salon} onSaved={(s) => setSalon(s)} />
        ) : null}
      </div>
    </div>
  )
}
