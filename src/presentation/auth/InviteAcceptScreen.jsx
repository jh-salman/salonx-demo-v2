import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { authClient } from '../../auth/authClient.js'
import './authScreens.css'

export default function InviteAcceptScreen() {
  const { invitationId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    authClient.getSession().then(({ data }) => setSession(data))
  }, [])

  async function accept() {
    setBusy(true)
    setError('')
    setMsg('')
    try {
      const { error: err } = await authClient.organization.acceptInvitation({
        invitationId,
      })
      if (err) {
        setError(err.message || 'Could not accept invite')
        return
      }
      setMsg('Joined — opening Salon X')
      navigate('/screen1', { replace: true })
    } catch (e) {
      setError(e?.message || 'Accept failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>Staff invitation</h1>
        <p className="auth-muted">
          Sign in with your US phone on the welcome screen, then accept here.
        </p>
        {!session ? (
          <Link className="auth-btn" to="/">
            Go to Welcome / sign in
          </Link>
        ) : (
          <button
            type="button"
            className="auth-btn"
            disabled={busy}
            onClick={() => void accept()}
          >
            {busy ? 'Joining…' : 'Accept invitation'}
          </button>
        )}
        {error ? <p className="auth-error">{error}</p> : null}
        {msg ? <p className="auth-ok">{msg}</p> : null}
      </div>
    </div>
  )
}
