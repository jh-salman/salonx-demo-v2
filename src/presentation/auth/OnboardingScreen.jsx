import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAppApi } from '../../auth/authAppApi.js'
import './authScreens.css'

export default function OnboardingScreen() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await authAppApi.onboard({
        name: name.trim() || undefined,
        slug: slug.trim() || undefined,
      })
      navigate('/screen1', { replace: true })
    } catch (err) {
      setError(err.message || 'Onboarding failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <h1>Create your salon</h1>
        <p className="auth-muted">One organization · one public booking slug</p>
        <label className="auth-field">
          <span>Salon name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Samu Studio"
            autoComplete="organization"
          />
        </label>
        <label className="auth-field">
          <span>Slug</span>
          <input
            value={slug}
            onChange={(e) =>
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
            }
            placeholder="samu"
            autoComplete="off"
          />
          <span className="auth-hint">https://{slug || 'your-slug'}.salonx.com</span>
        </label>
        {error ? <p className="auth-error">{error}</p> : null}
        <button type="submit" className="auth-btn" disabled={busy}>
          {busy ? 'Creating…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
