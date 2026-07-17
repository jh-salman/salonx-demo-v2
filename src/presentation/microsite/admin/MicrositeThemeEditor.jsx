import { useState } from 'react'
import {
  micrositeApi,
  micrositeCanonicalUrl,
  micrositePreviewUrl,
} from '../micrositeApi'

const DAY_LABELS = [
  ['mon', 'Mon'],
  ['tue', 'Tue'],
  ['wed', 'Wed'],
  ['thu', 'Thu'],
  ['fri', 'Fri'],
  ['sat', 'Sat'],
  ['sun', 'Sun'],
]

export default function MicrositeThemeEditor({ salon, onSaved }) {
  const [primaryHex, setPrimaryHex] = useState(salon.primaryHex || '#3b82f6')
  const [tagline, setTagline] = useState(salon.tagline || '')
  const [logoUrl, setLogoUrl] = useState(salon.logoUrl || '')
  const [about, setAbout] = useState(salon.about || '')
  const [name, setName] = useState(salon.name || '')
  const [enabled, setEnabled] = useState(Boolean(salon.micrositeEnabled))
  const [hours, setHours] = useState(() => ({ ...(salon.bookingHours || {}) }))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  function toggleDay(day) {
    setHours((prev) => {
      const next = { ...prev }
      if (next[day]?.length) delete next[day]
      else next[day] = [{ start: '09:00', end: '17:00' }]
      return next
    })
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMsg('')
    try {
      const data = await micrositeApi.patchSalon(salon.slug, {
        name,
        primaryHex,
        tagline,
        logoUrl: logoUrl || null,
        about,
        bookingHours: hours,
        micrositeEnabled: enabled,
      })
      setMsg('Saved')
      onSaved?.(data.salon)
    } catch (err) {
      setError(err.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const publicUrl = micrositeCanonicalUrl(salon.slug)
  const previewUrl = micrositePreviewUrl(salon.slug)

  return (
    <form className="ms-admin" onSubmit={save}>
      <h2 className="ms-admin__title">Microsite theme</h2>
      <p className="ms-muted">
        Template: <strong>{salon.templateId}</strong> · slug locked:{' '}
        <code>{salon.slug}</code>
      </p>

      <label className="ms-field ms-field--row">
        <span>Enabled</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
      </label>

      <label className="ms-field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="ms-field">
        <span>Primary color</span>
        <input
          type="color"
          value={primaryHex}
          onChange={(e) => setPrimaryHex(e.target.value)}
        />
      </label>

      <label className="ms-field">
        <span>Tagline</span>
        <input value={tagline} onChange={(e) => setTagline(e.target.value)} />
      </label>

      <label className="ms-field">
        <span>Logo URL</span>
        <input
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://…"
        />
      </label>

      <label className="ms-field">
        <span>About</span>
        <textarea
          rows={2}
          value={about}
          onChange={(e) => setAbout(e.target.value)}
        />
      </label>

      <fieldset className="ms-hours">
        <legend>Booking days</legend>
        <div className="ms-hours__grid">
          {DAY_LABELS.map(([key, label]) => (
            <label key={key} className="ms-hours__day">
              <input
                type="checkbox"
                checked={Boolean(hours[key]?.length)}
                onChange={() => toggleDay(key)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="ms-link-box">
        <span>Public URL (production)</span>
        <code>{publicUrl}</code>
        <button
          type="button"
          className="ms-btn ms-btn--ghost"
          onClick={() => navigator.clipboard?.writeText(publicUrl)}
        >
          Copy
        </button>
        <span>Local preview</span>
        <code>{previewUrl}</code>
        <a className="ms-btn ms-btn--ghost" href={previewUrl} target="_blank" rel="noreferrer">
          Open preview
        </a>
      </div>

      {error ? <p className="ms-error">{error}</p> : null}
      {msg ? <p className="ms-ok">{msg}</p> : null}

      <button type="submit" className="ms-btn ms-btn--primary" disabled={busy}>
        {busy ? 'Saving…' : 'Save theme'}
      </button>
    </form>
  )
}
