import { useCallback, useEffect, useState } from 'react'
import { authAppApi } from '../../auth/authAppApi.js'

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

/** Organization switch + create — Settings (gear) bar. */
export default function SettingsOrgPanel() {
  const [me, setMe] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await authAppApi.me()
      setMe(data)
      setError('')
      if (!data.members?.length) setShowCreate(true)
    } catch (e) {
      setMe(null)
      if (e.status === 401) {
        setError('Sign in to manage organizations')
      } else {
        setError(e.message || 'Could not load organizations')
      }
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function switchOrg(organizationId) {
    if (!organizationId || busy) return
    if (me?.session?.activeOrganizationId === organizationId) return
    setBusy(true)
    setError('')
    try {
      await authAppApi.switchOrganization(organizationId)
      window.location.reload()
    } catch (e) {
      setError(e.message || 'Switch failed')
      setBusy(false)
    }
  }

  async function createOrg(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const n = name.trim() || 'My Salon'
      const s = (slug.trim() || slugify(n)).toLowerCase()
      await authAppApi.createOrganization({ name: n, slug: s })
      window.location.reload()
    } catch (err) {
      setError(err.message || 'Create failed')
      setBusy(false)
    }
  }

  const members = me?.members || []
  const activeId = me?.session?.activeOrganizationId
  const activeSalon = me?.activeSalon

  return (
    <div className="sx-settings">
      {error ? <p className="sx-alert sx-alert--err">{error}</p> : null}

      <div className="sx-card">
        <div className="sx-card__head">
          <h3 className="sx-card__title">Your salons</h3>
          <button
            type="button"
            className="sx-btn sx-btn--ghost sx-btn--sm"
            disabled={busy}
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? 'Cancel' : '+ New'}
          </button>
        </div>

        {members.length ? (
          <ul className="sx-orgList">
            {members.map((m) => {
              const orgName = m.organization?.name || m.organizationId
              const isActive = m.organizationId === activeId
              return (
                <li
                  key={m.organizationId}
                  className={`sx-orgItem${isActive ? ' is-active' : ''}`}
                >
                  <span className="sx-avatar">{orgName.charAt(0)}</span>
                  <span className="sx-orgItem__meta">
                    <span className="sx-orgItem__name">{orgName}</span>
                    {isActive && activeSalon?.slug ? (
                      <span className="sx-orgItem__slug">{activeSalon.slug}</span>
                    ) : null}
                  </span>
                  {isActive ? (
                    <span className="sx-badge">Active</span>
                  ) : (
                    <button
                      type="button"
                      className="sx-btn sx-btn--ghost sx-btn--sm"
                      disabled={busy}
                      onClick={() => switchOrg(m.organizationId)}
                    >
                      Switch
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="sx-empty">No salons yet — create your first one.</p>
        )}
      </div>

      {showCreate ? (
        <form className="sx-card" onSubmit={createOrg}>
          <h3 className="sx-card__title">Create a salon</h3>
          <div className="sx-field">
            <label className="sx-label" htmlFor="sx-org-name">
              Salon name
            </label>
            <input
              id="sx-org-name"
              className="sx-input"
              value={name}
              onChange={(e) => {
                const next = e.target.value
                setName(next)
                if (!slugTouched) setSlug(slugify(next))
              }}
              placeholder="e.g. The Hair Loft"
              required
            />
          </div>
          <div className="sx-field">
            <label className="sx-label" htmlFor="sx-org-slug">
              URL slug
            </label>
            <input
              id="sx-org-slug"
              className="sx-input"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(slugify(e.target.value))
              }}
              placeholder="the-hair-loft"
              required
            />
            <span className="sx-hint">
              {(slug || 'your-salon')}.salonx.com
            </span>
          </div>
          <button type="submit" className="sx-btn sx-btn--primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create salon'}
          </button>
        </form>
      ) : null}
    </div>
  )
}
