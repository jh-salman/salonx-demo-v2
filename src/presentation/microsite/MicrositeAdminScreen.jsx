import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import CreateFromTemplate from './admin/CreateFromTemplate'
import MicrositeThemeEditor from './admin/MicrositeThemeEditor'
import { authAppApi } from '../../auth/authAppApi.js'
import { micrositeApi } from './micrositeApi'
import './microsite.css'

/**
 * Stylist Microsite panel — always scoped to the active organization salon.
 */
export default function MicrositeAdminScreen() {
  const [salon, setSalon] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsOrg, setNeedsOrg] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    setNeedsOrg(false)
    try {
      const me = await authAppApi.me()
      if (!me?.members?.length || !me?.session?.activeOrganizationId) {
        setSalon(null)
        setNeedsOrg(true)
        return
      }

      // Prefer activeSalon from session (org → salon 1:1).
      if (me.activeSalon) {
        setSalon(me.activeSalon)
        return
      }

      // Fallback: list (API filters to member orgs) → match active org.
      const data = await micrositeApi.listSalons()
      const list = data.salons || []
      const activeOrgId = me.session.activeOrganizationId
      const mine =
        list.find((s) => s.organizationId === activeOrgId) || list[0] || null
      setSalon(mine)
    } catch (e) {
      setSalon(null)
      setError(e.message || 'Failed to load microsite')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="ms-shell ms-shell--admin">
      <div className="ms-shell__inner">
        <h1 className="ms-admin__page-title">Microsite</h1>
        {loading ? <p className="ms-muted">Loading…</p> : null}
        {error ? <p className="ms-error">{error}</p> : null}
        {!loading && needsOrg ? (
          <div className="ms-admin">
            <h2 className="ms-admin__title">Create an organization first</h2>
            <p className="ms-muted">
              Microsite belongs to your active organization. Create or switch an
              org in Settings, then come back here.
            </p>
            <Link className="ms-btn ms-btn--primary" to="/settings">
              Open Settings
            </Link>
          </div>
        ) : null}
        {!loading && !needsOrg && !salon ? (
          <CreateFromTemplate
            onCreated={(s) => {
              setSalon(s)
              void refresh()
            }}
          />
        ) : null}
        {!loading && salon ? (
          <MicrositeThemeEditor
            salon={salon}
            onSaved={(s) => setSalon(s)}
          />
        ) : null}
      </div>
    </div>
  )
}
