import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { authAppApi } from '../../auth/authAppApi.js'
import './authScreens.css'

/**
 * Soft gate for stylist tools (Microsite, etc.).
 * Uses `/api/auth-app/me` (cookie session) — more reliable than client getSession alone.
 * On failure: show sign-in card here (do not dump onto blank black Home).
 */
export default function RequireSession({ children }) {
  const location = useLocation()
  const [state, setState] = useState('loading')

  useEffect(() => {
    let alive = true
    authAppApi
      .me()
      .then(() => {
        if (alive) setState('ok')
      })
      .catch(() => {
        if (alive) setState('no')
      })
    return () => {
      alive = false
    }
  }, [location.pathname])

  if (state === 'loading') {
    return (
      <div className="auth-screen">
        <p className="auth-muted">Checking session…</p>
      </div>
    )
  }

  if (state === 'no') {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1>Sign in required</h1>
          <p className="auth-muted">
            Sign in with your phone to open Microsite and org settings.
          </p>
          <Link
            className="auth-btn"
            to="/"
            state={{ from: location.pathname }}
          >
            Go to welcome
          </Link>
        </div>
      </div>
    )
  }

  return children
}
