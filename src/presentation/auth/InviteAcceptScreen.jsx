import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { authAppApi } from '../../auth/authAppApi.js'
import { ensureMe } from '../../store/sessionSlice.js'
import {
  clearPendingInvite,
  setPendingInvite,
} from '../../auth/pendingInvite.js'
import './authScreens.css'

/**
 * `/invite/:invitationId` — link-based accept.
 * Signed in → auto-join the org and enter the app.
 * Signed out → remember the invite and bounce to welcome sign-in; Screen0
 * returns here afterwards.
 */
export default function InviteAcceptScreen() {
  const { invitationId } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [state, setState] = useState('working') // working | error
  const [error, setError] = useState('')
  const ranRef = useRef(false)

  const run = useCallback(async () => {
    if (!invitationId) {
      setState('error')
      setError('Invalid invitation link')
      return
    }
    try {
      await dispatch(ensureMe({ force: true }))
    } catch {
      // Not signed in — remember invite, go sign in, come back here.
      setPendingInvite(invitationId)
      navigate('/', { replace: true })
      return
    }
    try {
      await authAppApi.acceptInvite(invitationId)
      clearPendingInvite()
      // Membership just changed — refresh the cached session/org state.
      await dispatch(ensureMe({ force: true })).catch(() => {})
      navigate('/screen1', { replace: true })
    } catch (e) {
      clearPendingInvite()
      setState('error')
      setError(e?.message || 'Could not accept this invitation')
    }
  }, [invitationId, navigate, dispatch])

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    void run()
  }, [run])

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>Staff invitation</h1>
        {state === 'working' ? (
          <p className="auth-muted">Joining your salon…</p>
        ) : (
          <>
            <p className="auth-error">{error}</p>
            <button
              type="button"
              className="auth-btn"
              onClick={() => {
                setState('working')
                setError('')
                ranRef.current = false
                void run()
              }}
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  )
}
