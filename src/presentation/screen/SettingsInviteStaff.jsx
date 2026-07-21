import { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { authAppApi } from '../../auth/authAppApi.js'
import { cancelOrgInvitation, inviteOrgMember } from '../../auth/authClient.js'
import {
  ensureTeam,
  selectTeamCallerRole,
  selectTeamInvitations,
  selectTeamMembers,
  selectTeamStatus,
} from '../../store/teamSlice.js'

function statusMeta(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'pending') return { label: 'Pending', tone: 'pending' }
  if (s === 'accepted') return { label: 'Accepted', tone: 'accepted' }
  if (s === 'canceled' || s === 'cancelled')
    return { label: 'Canceled', tone: 'canceled' }
  if (s === 'expired') return { label: 'Expired', tone: 'expired' }
  if (s === 'rejected') return { label: 'Rejected', tone: 'canceled' }
  return { label: status || '—', tone: 'muted' }
}

function memberLabel(m) {
  const u = m?.user || {}
  return u.name || u.phoneNumber || u.email || m?.userId || 'Member'
}

function memberSub(m) {
  const u = m?.user || {}
  const bits = []
  if (u.phoneNumber) bits.push(u.phoneNumber)
  if (u.email && !String(u.email).endsWith('@users.salonx.local')) {
    bits.push(u.email)
  }
  bits.push(m?.role || 'member')
  return bits.join(' · ')
}

/** Staff invite + members + dynamic invitation statuses — Settings. */
export default function SettingsInviteStaff({ pageMode = false }) {
  const dispatch = useDispatch()
  const members = useSelector(selectTeamMembers)
  const invites = useSelector(selectTeamInvitations)
  const callerRole = useSelector(selectTeamCallerRole)
  const teamStatus = useSelector(selectTeamStatus)

  const [open] = useState(pageMode)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null) // { kind, title, body, run }

  const canManage =
    String(callerRole).toLowerCase() === 'owner' ||
    String(callerRole).toLowerCase() === 'admin'

  // Show spinner only on the first empty load — cached revisits render instantly.
  const listBusy = teamStatus === 'loading' && members.length === 0 && invites.length === 0

  const refresh = useCallback(
    async (force = false) => {
      try {
        await dispatch(ensureTeam(force ? { force: true } : undefined))
      } catch {
        /* keep last good cache */
      }
    },
    [dispatch],
  )

  useEffect(() => {
    if (open) void refresh(false)
  }, [open, refresh])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    setError('')
    try {
      await inviteOrgMember({ email: email.trim(), role })
      setMsg(`Invite sent to ${email.trim()}`)
      setEmail('')
      await refresh(true)
    } catch (err) {
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
          await refresh(true)
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

  function askConfirm({ kind, title, body, run }) {
    setConfirm({ kind, title, body, run })
  }

  async function runConfirm() {
    if (!confirm?.run || busy) return
    setBusy(true)
    setError('')
    setMsg('')
    try {
      await confirm.run()
      setConfirm(null)
      await refresh(true)
    } catch (err) {
      setError(err.message || 'Action failed')
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  function onCancelInvite(row) {
    askConfirm({
      kind: 'danger',
      title: 'Cancel invitation?',
      body: `Cancel the invite for ${row.email}? They will no longer be able to join with this link.`,
      run: async () => {
        await cancelOrgInvitation(row.id)
        setMsg('Invitation canceled')
      },
    })
  }

  function onDeleteInvite(row) {
    askConfirm({
      kind: 'danger',
      title: 'Delete invitation?',
      body: `Permanently remove the ${statusMeta(row.status).label.toLowerCase()} invite for ${row.email}?`,
      run: async () => {
        await authAppApi.deleteInvitation(row.id)
        setMsg('Invitation deleted')
      },
    })
  }

  function onResend(row) {
    askConfirm({
      kind: 'primary',
      title: 'Resend invitation?',
      body: `Send a new invite email to ${row.email}?`,
      run: async () => {
        await inviteOrgMember({
          email: row.email,
          role: row.role || 'member',
          resend: true,
        })
        setMsg(`Invite re-sent to ${row.email}`)
      },
    })
  }

  function onRemoveMember(m) {
    askConfirm({
      kind: 'danger',
      title: 'Remove team member?',
      body: `${memberLabel(m)} will lose access to this salon. Their account stays — only this organization membership is removed.`,
      run: async () => {
        await authAppApi.removeMember(m.id)
        setMsg(`${memberLabel(m)} removed`)
      },
    })
  }

  const sortedInvites = [...invites].sort((a, b) => {
    const order = {
      pending: 0,
      accepted: 1,
      canceled: 2,
      cancelled: 2,
      expired: 3,
      rejected: 4,
    }
    const sa = order[String(a.status || '').toLowerCase()] ?? 9
    const sb = order[String(b.status || '').toLowerCase()] ?? 9
    if (sa !== sb) return sa - sb
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  })

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
          <div>
            <h3 className="sx-card__title">Team members</h3>
            <p className="sx-card__sub">
              {members.length
                ? `${members.length} in this salon`
                : 'People with access to this salon'}
            </p>
          </div>
          <button
            type="button"
            className="sx-btn sx-btn--ghost sx-btn--sm"
            onClick={() => void refresh(true)}
            disabled={teamStatus === 'loading'}
          >
            {teamStatus === 'loading' ? '…' : 'Refresh'}
          </button>
        </div>

        {listBusy ? (
          <p className="sx-empty">Loading…</p>
        ) : members.length === 0 ? (
          <p className="sx-empty">No members yet</p>
        ) : (
          <ul className="sx-inviteList">
            {members.map((m) => (
              <li key={m.id} className="sx-inviteItem">
                <span className="sx-avatar">{memberLabel(m).charAt(0)}</span>
                <span className="sx-inviteItem__meta">
                  <span className="sx-inviteItem__email">
                    {memberLabel(m)}
                    {m.isSelf ? ' (you)' : ''}
                  </span>
                  <span className="sx-inviteItem__role">{memberSub(m)}</span>
                </span>
                <span
                  className={`sx-status sx-status--${String(m.role || 'member').toLowerCase()}`}
                >
                  {m.role || 'member'}
                </span>
                {canManage && !m.isSelf ? (
                  <div className="sx-inviteItem__actions">
                    <button
                      type="button"
                      className="sx-btn sx-btn--danger sx-btn--sm"
                      disabled={busy}
                      onClick={() => onRemoveMember(m)}
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sx-card">
        <div className="sx-card__head">
          <div>
            <h3 className="sx-card__title">Invitations</h3>
            <p className="sx-card__sub">
              Status updates live — Pending, Accepted, Canceled, Expired
            </p>
          </div>
        </div>

        {sortedInvites.length === 0 ? (
          <p className="sx-empty">No invitations yet</p>
        ) : (
          <ul className="sx-inviteList">
            {sortedInvites.map((row) => {
              const st = statusMeta(row.status)
              const isPending = st.tone === 'pending'
              return (
                <li key={row.id} className="sx-inviteItem">
                  <span className="sx-avatar">
                    {(row.email || '?').charAt(0)}
                  </span>
                  <span className="sx-inviteItem__meta">
                    <span className="sx-inviteItem__email">{row.email}</span>
                    <span className="sx-inviteItem__role">
                      {row.role || 'member'}
                    </span>
                  </span>
                  <span className={`sx-status sx-status--${st.tone}`}>
                    {st.label}
                  </span>
                  <div className="sx-inviteItem__actions">
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          className="sx-btn sx-btn--ghost sx-btn--sm"
                          disabled={busy}
                          onClick={() => onResend(row)}
                        >
                          Resend
                        </button>
                        <button
                          type="button"
                          className="sx-btn sx-btn--danger sx-btn--sm"
                          disabled={busy}
                          onClick={() => onCancelInvite(row)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : canManage ? (
                      <button
                        type="button"
                        className="sx-btn sx-btn--danger sx-btn--sm"
                        disabled={busy}
                        onClick={() => onDeleteInvite(row)}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {confirm ? (
        <div
          className="sx-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sx-confirm-title"
        >
          <button
            type="button"
            className="sx-modal__scrim"
            aria-label="Close"
            onClick={() => !busy && setConfirm(null)}
          />
          <div className="sx-modal__card">
            <h3 id="sx-confirm-title" className="sx-card__title">
              {confirm.title}
            </h3>
            <p className="sx-card__sub" style={{ marginTop: 8 }}>
              {confirm.body}
            </p>
            <div className="sx-actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="sx-btn sx-btn--ghost"
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                Keep
              </button>
              <button
                type="button"
                className={`sx-btn ${confirm.kind === 'danger' ? 'sx-btn--danger' : 'sx-btn--primary'}`}
                disabled={busy}
                onClick={() => void runConfirm()}
              >
                {busy ? '…' : confirm.kind === 'danger' ? 'Confirm' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
