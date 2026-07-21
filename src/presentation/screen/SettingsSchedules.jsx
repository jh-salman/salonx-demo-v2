import { useCallback, useEffect, useMemo, useState } from 'react'
import SettingsSubScreen from './SettingsSubScreen'
import {
  fetchStaffCatalog,
  saveStaffCatalogRemote,
} from '../../data/calendarCatalogApi.js'

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
const DEFAULT_LUNCH = { start: '12:00', end: '13:00' }

/** Day-keyed → { day: {start,end} } single-window map. */
function toDayMap(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const out = {}
  for (const [key] of DAY_LABELS) {
    const win = Array.isArray(src[key]) ? src[key][0] : null
    if (win && typeof win.start === 'string' && typeof win.end === 'string') {
      out[key] = { start: win.start, end: win.end }
    }
  }
  return out
}

/** { day: {start,end} } → day-keyed [{start,end}] for the API. */
function toApiSchedule(map) {
  const out = {}
  for (const [key] of DAY_LABELS) {
    const win = map[key]
    if (win?.start && win?.end) out[key] = [{ start: win.start, end: win.end }]
  }
  return out
}

function initialOf(name) {
  const s = String(name || 'S').trim()
  return (s.charAt(0) || 'S').toUpperCase()
}

/** /settings/schedules — per-stylist hours, lunch/breaks, self-manage grant. */
export default function SettingsSchedules() {
  const [staff, setStaff] = useState([])
  const [updatedAt, setUpdatedAt] = useState(null)
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  // Draft for the selected stylist.
  const [customHours, setCustomHours] = useState(false)
  const [hours, setHours] = useState({})
  const [lunch, setLunch] = useState({})
  const [canSelfManage, setCanSelfManage] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchStaffCatalog()
      const list = Array.isArray(res?.staff) ? res.staff : []
      setStaff(list)
      setUpdatedAt(res?.updatedAt || null)
      if (list[0]?.id) setSelectedId(String(list[0].id))
    } catch (e) {
      if (e.status === 401) setError('Sign in to edit schedules')
      else setError(e.message || 'Could not load staff')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selected = useMemo(
    () => staff.find((s) => String(s.id) === selectedId) || null,
    [staff, selectedId],
  )

  // Hydrate the draft when the selected stylist changes.
  useEffect(() => {
    if (!selected) return
    const wh = toDayMap(selected.workingHours)
    setCustomHours(Object.keys(wh).length > 0)
    setHours(wh)
    setLunch(toDayMap(selected.breaks))
    setCanSelfManage(Boolean(selected.canSelfManage))
    setMsg('')
  }, [selected])

  function toggleDay(day) {
    setHours((prev) => {
      const next = { ...prev }
      if (next[day]) delete next[day]
      else next[day] = { ...DEFAULT_WINDOW }
      return next
    })
    setMsg('')
  }
  function setDayTime(day, field, value) {
    setHours((prev) => ({
      ...prev,
      [day]: { ...(prev[day] || DEFAULT_WINDOW), [field]: value },
    }))
    setMsg('')
  }
  function toggleLunch(day) {
    setLunch((prev) => {
      const next = { ...prev }
      if (next[day]) delete next[day]
      else next[day] = { ...DEFAULT_LUNCH }
      return next
    })
    setMsg('')
  }
  function setLunchTime(day, field, value) {
    setLunch((prev) => ({
      ...prev,
      [day]: { ...(prev[day] || DEFAULT_LUNCH), [field]: value },
    }))
    setMsg('')
  }

  async function save(e) {
    e.preventDefault()
    if (!selected) return
    setBusy(true)
    setError('')
    setMsg('')
    try {
      const nextStaff = {
        ...selected,
        canSelfManage,
        breaks: toApiSchedule(lunch),
      }
      if (customHours) nextStaff.workingHours = toApiSchedule(hours)
      else delete nextStaff.workingHours

      const nextList = staff.map((s) =>
        String(s.id) === String(selected.id) ? nextStaff : s,
      )
      const res = await saveStaffCatalogRemote({
        staff: nextList,
        expectedUpdatedAt: updatedAt,
      })
      setStaff(Array.isArray(res?.staff) ? res.staff : nextList)
      setUpdatedAt(res?.updatedAt || null)
      setMsg('Schedule saved')
    } catch (err) {
      if (err.code === 'CONFLICT') {
        setError('Someone else updated staff — reloading.')
        await load()
      } else {
        setError(err.message || 'Save failed')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsSubScreen
      title="Stylist schedules"
      subtitle="Hours, lunch & breaks for each stylist — and who can edit live."
    >
      <div className="sx-settings">
        {error && !staff.length ? (
          <div className="sx-card">
            <p className="sx-alert sx-alert--err">{error}</p>
          </div>
        ) : null}

        {!staff.length && !error ? (
          <div className="sx-card">
            <p className="sx-empty">No stylists yet — invite your team first.</p>
          </div>
        ) : null}

        {staff.length ? (
          <>
            <div className="sx-card">
              <div className="sx-card__head">
                <div>
                  <h3 className="sx-card__title">Stylist</h3>
                  <p className="sx-card__sub">
                    Pick who you&apos;re editing
                  </p>
                </div>
              </div>
              <div className="sx-chips" role="tablist" aria-label="Stylists">
                {staff.map((s) => {
                  const id = String(s.id)
                  const active = id === selectedId
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`sx-chip${active ? ' is-active' : ''}`}
                      onClick={() => setSelectedId(id)}
                    >
                      <span className="sx-chip__avatar" aria-hidden="true">
                        {initialOf(s.name)}
                      </span>
                      <span className="sx-chip__label">{s.name || 'Stylist'}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {selected ? (
              <form className="sx-card sx-sched" onSubmit={save}>
                <div className="sx-card__head">
                  <div>
                    <h3 className="sx-card__title">{selected.name || 'Stylist'}</h3>
                    <p className="sx-card__sub">
                      {customHours
                        ? 'Custom weekly hours'
                        : 'Following salon business hours'}
                    </p>
                  </div>
                  {canSelfManage ? (
                    <span className="sx-badge">Self-manage</span>
                  ) : null}
                </div>

                <label className="sx-row-toggle">
                  <span className="sx-row-toggle__text">
                    <span className="sx-row-toggle__title">Allow self-manage</span>
                    <span className="sx-row-toggle__sub">
                      Stylist can edit hours &amp; breaks live on the calendar
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={canSelfManage}
                    onChange={(e) => {
                      setCanSelfManage(e.target.checked)
                      setMsg('')
                    }}
                  />
                  <span className="sx-switch" aria-hidden="true" />
                </label>

                <label className="sx-row-toggle">
                  <span className="sx-row-toggle__text">
                    <span className="sx-row-toggle__title">Custom hours</span>
                    <span className="sx-row-toggle__sub">
                      Off = follows salon business hours
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={customHours}
                    onChange={(e) => {
                      setCustomHours(e.target.checked)
                      setMsg('')
                    }}
                  />
                  <span className="sx-switch" aria-hidden="true" />
                </label>

                {!customHours ? (
                  <p className="sx-sched__hint">
                    Working days follow salon hours. You can still set a lunch
                    or break per day below.
                  </p>
                ) : null}

                <div className="sx-days sx-days--sched">
                  {DAY_LABELS.map(([key, label]) => {
                    const openDay = Boolean(hours[key])
                    const win = hours[key] || DEFAULT_WINDOW
                    const lunchOn = Boolean(lunch[key])
                    const lw = lunch[key] || DEFAULT_LUNCH
                    const dayActive = customHours ? openDay : true
                    return (
                      <div
                        key={key}
                        className={`sx-day sx-day--sched${dayActive ? ' is-open' : ''}`}
                      >
                        <div className="sx-day__row">
                          {customHours ? (
                            <label className="sx-day__toggle">
                              <input
                                type="checkbox"
                                checked={openDay}
                                onChange={() => toggleDay(key)}
                              />
                              <span className="sx-switch" aria-hidden="true" />
                              <span className="sx-day__name">{label}</span>
                            </label>
                          ) : (
                            <span className="sx-day__name">{label}</span>
                          )}

                          {customHours && openDay ? (
                            <div className="sx-day__times">
                              <input
                                type="time"
                                className="sx-time"
                                value={win.start}
                                onChange={(e) =>
                                  setDayTime(key, 'start', e.target.value)
                                }
                                required
                              />
                              <span className="sx-day__dash">–</span>
                              <input
                                type="time"
                                className="sx-time"
                                value={win.end}
                                onChange={(e) =>
                                  setDayTime(key, 'end', e.target.value)
                                }
                                required
                              />
                            </div>
                          ) : null}
                          {customHours && !openDay ? (
                            <span className="sx-day__closed">Off</span>
                          ) : null}
                          {!customHours ? (
                            <span className="sx-day__salon">Salon hours</span>
                          ) : null}
                        </div>

                        <label
                          className={`sx-lunch${lunchOn ? ' is-on' : ''}${!dayActive ? ' is-disabled' : ''}`}
                        >
                          <span className="sx-lunch__check">
                            <input
                              type="checkbox"
                              checked={lunchOn}
                              disabled={!dayActive}
                              onChange={() => toggleLunch(key)}
                            />
                            <span className="sx-lunch__box" aria-hidden="true" />
                            <span className="sx-lunch__label">Lunch / break</span>
                          </span>
                          {lunchOn && dayActive ? (
                            <span className="sx-day__times">
                              <input
                                type="time"
                                className="sx-time"
                                value={lw.start}
                                onChange={(e) =>
                                  setLunchTime(key, 'start', e.target.value)
                                }
                                required
                              />
                              <span className="sx-day__dash">–</span>
                              <input
                                type="time"
                                className="sx-time"
                                value={lw.end}
                                onChange={(e) =>
                                  setLunchTime(key, 'end', e.target.value)
                                }
                                required
                              />
                            </span>
                          ) : null}
                        </label>
                      </div>
                    )
                  })}
                </div>

                <div className="sx-actions">
                  <button
                    type="submit"
                    className="sx-btn sx-btn--primary"
                    disabled={busy}
                  >
                    {busy ? 'Saving…' : 'Save schedule'}
                  </button>
                  {msg ? <span className="sx-inline-ok">{msg}</span> : null}
                  {error ? <span className="sx-inline-err">{error}</span> : null}
                </div>
              </form>
            ) : null}
          </>
        ) : null}
      </div>
    </SettingsSubScreen>
  )
}
