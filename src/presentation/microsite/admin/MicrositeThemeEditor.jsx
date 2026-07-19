import { useState } from 'react'
import {
  micrositeApi,
  micrositeCanonicalUrl,
  micrositePreviewUrl,
} from '../micrositeApi'
import {
  MICROSITE_FONT_BODIES,
  MICROSITE_FONT_HEADINGS,
  normalizeMicrositeTheme,
} from '../micrositeTheme'

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
  const initialTheme = normalizeMicrositeTheme(salon.theme)
  const [primaryHex, setPrimaryHex] = useState(salon.primaryHex || '#3b82f6')
  const [tagline, setTagline] = useState(salon.tagline || '')
  const [logoUrl, setLogoUrl] = useState(salon.logoUrl || '')
  const [about, setAbout] = useState(salon.about || '')
  const [phone, setPhone] = useState(salon.phone || '')
  const [name, setName] = useState(salon.name || '')
  const [enabled, setEnabled] = useState(Boolean(salon.micrositeEnabled))
  const [hours, setHours] = useState(() => ({ ...(salon.bookingHours || {}) }))
  const [theme, setTheme] = useState(initialTheme)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  function patchTheme(partial) {
    setTheme((prev) => ({ ...prev, ...partial }))
  }

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
        phone: phone.trim() || null,
        primaryHex,
        tagline,
        logoUrl: logoUrl.trim() || null,
        about,
        bookingHours: hours,
        micrositeEnabled: enabled,
        theme: {
          fontHeading: theme.fontHeading,
          fontBody: theme.fontBody,
          heroImageUrl: theme.heroImageUrl?.trim() || null,
          heroTitle: theme.heroTitle,
          heroSubtitle: theme.heroSubtitle,
          ctaLabel: theme.ctaLabel,
          bgHex: theme.bgHex,
          surfaceHex: theme.surfaceHex,
          textHex: theme.textHex,
          mutedHex: theme.mutedHex,
        },
      })
      setMsg('Saved')
      if (data.salon?.theme) setTheme(normalizeMicrositeTheme(data.salon.theme))
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
        Landing layout is locked. Font, hero, logo, and colors are controllable
        here · template <strong>{salon.templateId}</strong>
      </p>

      <label className="ms-field ms-field--row">
        <span>Enabled</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
      </label>

      <fieldset className="ms-admin__group">
        <legend>Brand</legend>
        <label className="ms-field">
          <span>Salon name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="ms-field">
          <span>Logo URL</span>
          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://… (nav + footer)"
          />
        </label>
        {logoUrl ? (
          <div className="ms-admin__preview">
            <img src={logoUrl} alt="" />
          </div>
        ) : null}
        <label className="ms-field">
          <span>Primary accent</span>
          <input
            type="color"
            value={primaryHex}
            onChange={(e) => setPrimaryHex(e.target.value)}
          />
        </label>
        <label className="ms-field">
          <span>Phone (contact)</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1…"
          />
        </label>
      </fieldset>

      <fieldset className="ms-admin__group">
        <legend>Fonts</legend>
        <label className="ms-field">
          <span>Heading font</span>
          <select
            value={theme.fontHeading}
            onChange={(e) => patchTheme({ fontHeading: e.target.value })}
          >
            {MICROSITE_FONT_HEADINGS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="ms-field">
          <span>Body font</span>
          <select
            value={theme.fontBody}
            onChange={(e) => patchTheme({ fontBody: e.target.value })}
          >
            {MICROSITE_FONT_BODIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <p
          className="ms-admin__font-sample"
          style={{
            fontFamily:
              theme.fontHeading === 'system'
                ? 'ui-serif, Georgia, serif'
                : `"${theme.fontHeading}", serif`,
          }}
        >
          {theme.heroTitle || 'Book Your Appointment'}
        </p>
      </fieldset>

      <fieldset className="ms-admin__group">
        <legend>Hero section</legend>
        <label className="ms-field">
          <span>Hero image URL</span>
          <input
            value={theme.heroImageUrl || ''}
            onChange={(e) => patchTheme({ heroImageUrl: e.target.value })}
            placeholder="https://… full-bleed background"
          />
        </label>
        {theme.heroImageUrl ? (
          <div className="ms-admin__preview ms-admin__preview--hero">
            <img src={theme.heroImageUrl} alt="" />
          </div>
        ) : null}
        <label className="ms-field">
          <span>Hero title</span>
          <input
            value={theme.heroTitle}
            onChange={(e) => patchTheme({ heroTitle: e.target.value })}
          />
        </label>
        <label className="ms-field">
          <span>Hero subtitle</span>
          <input
            value={theme.heroSubtitle}
            onChange={(e) => patchTheme({ heroSubtitle: e.target.value })}
          />
        </label>
        <label className="ms-field">
          <span>CTA button label</span>
          <input
            value={theme.ctaLabel}
            onChange={(e) => patchTheme({ ctaLabel: e.target.value })}
          />
        </label>
      </fieldset>

      <fieldset className="ms-admin__group">
        <legend>Copy</legend>
        <label className="ms-field">
          <span>Tagline</span>
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} />
        </label>
        <label className="ms-field">
          <span>About / booking blurb</span>
          <textarea
            rows={3}
            value={about}
            onChange={(e) => setAbout(e.target.value)}
          />
        </label>
      </fieldset>

      <fieldset className="ms-admin__group">
        <legend>Surfaces</legend>
        <div className="ms-admin__colors">
          <label className="ms-field">
            <span>Background</span>
            <input
              type="color"
              value={theme.bgHex}
              onChange={(e) => patchTheme({ bgHex: e.target.value })}
            />
          </label>
          <label className="ms-field">
            <span>Surface</span>
            <input
              type="color"
              value={theme.surfaceHex}
              onChange={(e) => patchTheme({ surfaceHex: e.target.value })}
            />
          </label>
          <label className="ms-field">
            <span>Text</span>
            <input
              type="color"
              value={theme.textHex}
              onChange={(e) => patchTheme({ textHex: e.target.value })}
            />
          </label>
          <label className="ms-field">
            <span>Muted</span>
            <input
              type="color"
              value={theme.mutedHex}
              onChange={(e) => patchTheme({ mutedHex: e.target.value })}
            />
          </label>
        </div>
      </fieldset>

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
        <span>Public URL</span>
        <code>{publicUrl}</code>
        <button
          type="button"
          className="ms-btn ms-btn--ghost"
          onClick={() => navigator.clipboard?.writeText(publicUrl)}
        >
          Copy
        </button>
        <span className="ms-muted">
          Clients open this host (not demo.salonx.com). Dev preview:
        </span>
        <code>{previewUrl}</code>
        <a
          className="ms-btn ms-btn--ghost"
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
        >
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
