import { useCallback, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import SettingsSubScreen from './SettingsSubScreen'
import { apiJson } from '../../lib/http.js'
import { startCalendarRealtimeSync } from '../../sync/calendarRealtimeSync.js'
import { selectActiveSalon } from '../../store/sessionSlice.js'

export default function SettingsWaitlist() {
  const activeSalon = useSelector(selectActiveSalon)
  const [entries, setEntries] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const data = await apiJson('/api/waitlist?status=open')
      setEntries(Array.isArray(data.entries) ? data.entries : [])
    } catch (e) {
      setError(e.message || 'Failed to load')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    return startCalendarRealtimeSync(
      {
        onToolbarUpdated: () => {
          void load()
        },
        onPoll: () => {
          void load()
        },
      },
      { getSalonId: () => activeSalon?.id },
    )
  }, [activeSalon?.id, load])

  async function dismiss(id) {
    try {
      await apiJson(`/api/waitlist/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: { status: 'dismissed' },
      })
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (e) {
      setError(e.message || 'Update failed')
    }
  }

  return (
    <SettingsSubScreen
      title="Waiting list"
      subtitle="Clients who could not find a time — manual follow-up"
    >
      {error ? <p className="settings-org__err">{error}</p> : null}
      {busy && !entries.length ? <p className="settings-org__hint">Loading…</p> : null}
      {!busy && !entries.length ? (
        <p className="settings-org__hint">No open waitlist entries.</p>
      ) : null}
      <ul className="settings-waitlist">
        {entries.map((e) => (
          <li key={e.id} className="settings-waitlist__item">
            <div>
              <strong>{e.clientName}</strong>
              <div className="settings-org__hint">{e.clientPhone}</div>
              {e.preferredWindow ? (
                <div className="settings-org__hint">Window: {e.preferredWindow}</div>
              ) : null}
              {e.preferredDates?.length ? (
                <div className="settings-org__hint">
                  Dates: {e.preferredDates.join(', ')}
                </div>
              ) : null}
              {e.notes ? <div className="settings-org__hint">{e.notes}</div> : null}
            </div>
            <button
              type="button"
              className="settings-org__createBtn"
              onClick={() => dismiss(e.id)}
            >
              Dismiss
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="settings-org__submit"
        onClick={load}
        disabled={busy}
        style={{ marginTop: 12 }}
      >
        Refresh
      </button>
    </SettingsSubScreen>
  )
}
