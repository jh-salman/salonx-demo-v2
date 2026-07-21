import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { ensureMe, selectMe } from '../../store/sessionSlice.js'
import './authScreens.css'

/**
 * Soft gate for stylist tools (Microsite, etc.).
 * Session lives in the Redux store (`ensureMe` dedupes the `/api/auth-app/me`
 * cookie-session check), so route changes reuse the cached session instead of
 * refetching. On failure: show sign-in card here (do not dump onto blank black
 * Home).
 */
export default function RequireSession({ children }) {
  const location = useLocation()
  const dispatch = useDispatch()
  const me = useSelector(selectMe)
  const [state, setState] = useState(me?.user ? 'ok' : 'loading')

  useEffect(() => {
    let alive = true
    dispatch(ensureMe())
      .then((data) => {
        if (alive) setState(data?.user ? 'ok' : 'no')
      })
      .catch(() => {
        if (alive) setState('no')
      })
    return () => {
      alive = false
    }
  }, [location.pathname, dispatch])

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
