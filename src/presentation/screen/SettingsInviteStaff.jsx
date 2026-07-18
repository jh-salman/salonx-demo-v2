import { useCallback, useEffect, useState } from 'react'
import {
  cancelOrgInvitation,
  inviteOrgMember,
  listOrgInvitations,
} from '../../auth/authClient.js'

function statusLabel(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'pending') return 'Pending'
  if (s === 'accepted') return 'Accepted'
  if (s === 'canceled' || s === 'cancelled') return 'Canceled'
  if (s === 'rejected') return 'Rejected'
  return status || '—'
}

/** Staff invite + pending list / cancel — Settings (gear). */
export default function SettingsInviteStaff({ pageMode = false }) {
  const [open] = useState(pageMode)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [busy, setBusy] = useState(false)
  const [listBusy, setListBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [invites, setInvites] = useState([])

  const refreshInvites = useCallback(async () => {
    setListBusy(true)
    try {
      const rows = await listOrgInvitations()
      setInvites(Array.isArray(rows) ? rows : [])
    } catch {
      setInvites([])
    } finally {
      setListBusy(false)
    }
  }, [])

  useEffect(() => {
    if (open) void refreshInvites()
  }, [open, refreshInvites])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    setError('')
    try {
      await inviteOrgMember({
        email: email.trim(),
        role,
      })
      setMsg(`Invite sent to ${email.trim()}`)
      setEmail('')
      await refreshInvites()
    } catch (err) {
      // Already invited → offer resend path via same form retry with resend
      const text = err.message || 'Invite failed'
      if (/already invited/i.test(text)) {
        try {
          await inviteOrgMember({
            email: email.trim(),
            role,
            resend: true,
          })
          setMsg(`Invite re-sent to ${email.trim()}`)
          setEmail('')
          await refreshInvites()
          return
        } catch (e2) {
          setError(e2.message || text)
          return
        }
      }
      setError(text)
    } finally {
      setBusy(false)
    }
  }

  async function onCancel(invitationId) {
    if (!invitationId || busy) return
    setBusy(true)
    setError('')
    setMsg('')
    try {
      await cancelOrgInvitation(invitationId)
      setMsg('Invitation canceled')
      await refreshInvites()
    } catch (err) {
      setError(err.message || 'Cancel failed')
    } finally {
      setBusy(false)
    }
  }

  async function onResend(row) {
    if (!row?.email || busy) return
    setBusy(true)
    setError('')
    setMsg('')
    try {
      await inviteOrgMember({
        email: row.email,
        role: row.role || 'member',
        resend: true,
      })
      setMsg(`Invite re-sent to ${row.email}`)
      await refreshInvites()
    } catch (err) {
      setError(err.message || 'Resend failed')
    } finally {
      setBusy(false)
    }
  }

  const pending = invites.filter(
    (i) => String(i.status || '').toLowerCase() === 'pending',
  )

  if (!open) return null

  return (
    <div className="sx-settings">
      <form className="sx-card" onSubmit={submit}>
        <h3 className="sx-card__title">Invite a team member</h3>
        <div className="sx-field">
          <label className="sx-label" htmlFor="sx-invite-email">
            Email address
          </label>
          <input
            id="sx-invite-email"
            type="email"
            required
            className="sx-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="stylist@email.com"
          />
        </div>
        <div className="sx-field">
          <label className="sx-label" htmlFor="sx-invite-role">
            Role
          </label>
          <select
            id="sx-invite-role"
            className="sx-select"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="submit" className="sx-btn sx-btn--primary" disabled={busy}>
          {busy ? 'Sending…' : 'Send invite'}
        </button>
        {msg ? <p className="sx-alert sx-alert--ok">{msg}</p> : null}
        {error ? <p className="sx-alert sx-alert--err">{error}</p> : null}
      </form>

      <div className="sx-card">
        <div className="sx-card__head">
          <h3 className="sx-card__title">Pending invitations</h3>
          <button
            type="button"
            className="sx-btn sx-btn--ghost sx-btn--sm"
            onClick={() => void refreshInvites()}
            disabled={listBusy}
          >
            {listBusy ? '…' : 'Refresh'}
          </button>
        </div>

        {pending.length === 0 ? (
          <p className="sx-empty">No pending invitations</p>
        ) : (
          <ul className="sx-inviteList">
            {pending.map((row) => (
              <li key={row.id} className="sx-inviteItem">
                <span className="sx-avatar">{(row.email || '?').charAt(0)}</span>
                <span className="sx-inviteItem__meta">
                  <span className="sx-inviteItem__email">{row.email}</span>
                  <span className="sx-inviteItem__role">
                    {row.role || 'member'} · {statusLabel(row.status)}
                  </span>
                </span>
                <div className="sx-inviteItem__actions">
                  <button
                    type="button"
                    className="sx-btn sx-btn--ghost sx-btn--sm"
                    disabled={busy}
                    onClick={() => void onResend(row)}
                  >
                    Resend
                  </button>
                  <button
                    type="button"
                    className="sx-btn sx-btn--danger sx-btn--sm"
                    disabled={busy}
                    onClick={() => void onCancel(row.id)}
                  >
                    Cancel
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
