import { useCallback, useEffect, useState } from 'react'
import { authAppApi } from '../../auth/authAppApi.js'
import { micrositeApi } from '../microsite/micrositeApi.js'

const DAY_LABELS = [
  ['mon', 'Monday'],
  ['tue', 'Tuesday'],
  ['wed', 'Wednesday'],
  ['thu', 'Thursday'],
  ['fri', 'Friday'],
  ['sat', 'Saturday'],
  ['sun', 'Sunday'],
]

const DEFAULT_WINDOW = { start: '09:00', end: '17:00' }

function normalizeHours(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const out = {}
  for (const [key] of DAY_LABELS) {
    const win = Array.isArray(src[key]) ? src[key][0] : null
    if (win && typeof win.start === 'string' && typeof win.end === 'string') {
      out[key] = [{ start: win.start, end: win.end }]
    }
  }
  return out
}

/** Active org salon booking hours — Settings (gear). */
export default function SettingsOrgHours({ pageMode = false }) {
  const [open] = useState(pageMode)
  const [salon, setSalon] = useState(null)
  const [hours, setHours] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const me = await authAppApi.me()
      const active = me?.activeSalon || null
      setSalon(active)
      setHours(normalizeHours(active?.bookingHours))
    } catch (e) {
      setSalon(null)
      setHours({})
      if (e.status === 401) {
        setError('Sign in to edit hours')
      } else {
        setError(e.message || 'Could not load hours')
      }
    }
  }, [])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  function toggleDay(day) {
    setHours((prev) => {
      const next = { ...prev }
      if (next[day]?.length) delete next[day]
      else next[day] = [{ ...DEFAULT_WINDOW }]
      return next
    })
    setMsg('')
  }

  function setDayTime(day, field, value) {
    setHours((prev) => {
      const cur = prev[day]?.[0] || { ...DEFAULT_WINDOW }
      return {
        ...prev,
        [day]: [{ ...cur, [field]: value }],
      }
    })
    setMsg('')
  }

  async function save(e) {
    e.preventDefault()
    if (!salon?.slug) {
      setError('Create an organization first')
      return
    }
    setBusy(true)
    setError('')
    setMsg('')
    try {
      const data = await micrositeApi.patchSalon(salon.slug, {
        bookingHours: hours,
      })
      setSalon(data.salon)
      setHours(normalizeHours(data.salon?.bookingHours))
      setMsg('Hours saved')
    } catch (err) {
      setError(err.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="sx-settings">
      {!salon ? (
        <div className="sx-card">
          <p className="sx-empty">
            No active salon — create an organization first.
          </p>
        </div>
      ) : (
        <form className="sx-card" onSubmit={save}>
          <div className="sx-card__head">
            <div>
              <h3 className="sx-card__title">Weekly hours</h3>
              <p className="sx-card__sub">{salon.name}</p>
            </div>
          </div>

          <div className="sx-days">
            {DAY_LABELS.map(([key, label]) => {
              const openDay = Boolean(hours[key]?.length)
              const win = hours[key]?.[0] || DEFAULT_WINDOW
              return (
                <div key={key} className={`sx-day${openDay ? ' is-open' : ''}`}>
                  <label className="sx-day__toggle">
                    <input
                      type="checkbox"
                      checked={openDay}
                      onChange={() => toggleDay(key)}
                    />
                    <span className="sx-switch" aria-hidden="true" />
                    <span className="sx-day__name">{label}</span>
                  </label>
                  {openDay ? (
                    <div className="sx-day__times">
                      <input
                        type="time"
                        className="sx-time"
                        value={win.start}
                        onChange={(e) => setDayTime(key, 'start', e.target.value)}
                        required
                      />
                      <span className="sx-day__dash">–</span>
                      <input
                        type="time"
                        className="sx-time"
                        value={win.end}
                        onChange={(e) => setDayTime(key, 'end', e.target.value)}
                        required
                      />
                    </div>
                  ) : (
                    <span className="sx-day__closed">Closed</span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="sx-actions">
            <button type="submit" className="sx-btn sx-btn--primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save hours'}
            </button>
            {msg ? <span className="sx-inline-ok">{msg}</span> : null}
            {error ? <span className="sx-inline-err">{error}</span> : null}
          </div>
        </form>
      )}
    </div>
  )
}
