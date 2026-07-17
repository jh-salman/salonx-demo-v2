import { useEffect, useState } from 'react'
import { micrositeApi } from '../micrositeApi'

export default function CreateFromTemplate({ onCreated }) {
  const [templates, setTemplates] = useState([])
  const [templateId, setTemplateId] = useState('sx-book-v1')
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [slugOk, setSlugOk] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    micrositeApi.listTemplates().then((d) => {
      setTemplates(d.templates || [])
      if (d.templates?.[0]?.id) setTemplateId(d.templates[0].id)
    })
  }, [])

  useEffect(() => {
    const s = slug.trim().toLowerCase()
    if (s.length < 2) {
      setSlugOk(null)
      return
    }
    const t = setTimeout(() => {
      micrositeApi
        .checkSlug(s)
        .then((d) => setSlugOk(Boolean(d.available)))
        .catch(() => setSlugOk(false))
    }, 300)
    return () => clearTimeout(t)
  }, [slug])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await micrositeApi.create({
        templateId,
        slug: slug.trim().toLowerCase(),
        name: name.trim() || undefined,
      })
      onCreated?.(data.salon)
    } catch (err) {
      setError(err.message || 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="ms-admin" onSubmit={submit}>
      <h2 className="ms-admin__title">Create from template</h2>
      <p className="ms-muted">
        Pick a Salon X template, choose a unique subdomain slug, then customize.
      </p>

      <div className="ms-tpl-grid">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`ms-tpl-card${templateId === t.id ? ' is-active' : ''}`}
            onClick={() => setTemplateId(t.id)}
          >
            <strong>{t.name}</strong>
            <span>{t.previewLabel}</span>
            <p>{t.description}</p>
          </button>
        ))}
      </div>

      <label className="ms-field">
        <span>Salon name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Taste Salon"
        />
      </label>

      <label className="ms-field">
        <span>Slug (subdomain)</span>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          placeholder="tast"
          pattern="[a-z0-9-]{2,32}"
          required
        />
        <span className="ms-field__hint">
          {slug ? `https://${slug || '…'}.salonx.com` : 'https://your-slug.salonx.com'}
          {slugOk === true ? ' · available' : ''}
          {slugOk === false ? ' · unavailable' : ''}
        </span>
      </label>

      {error ? <p className="ms-error">{error}</p> : null}

      <button
        type="submit"
        className="ms-btn ms-btn--primary"
        disabled={busy || slugOk === false}
      >
        {busy ? 'Creating…' : 'Create microsite'}
      </button>
    </form>
  )
}
