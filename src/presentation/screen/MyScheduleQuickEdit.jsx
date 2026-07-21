import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchMe, selectMe } from '../../store/sessionSlice.js'
import {
  fetchStaffCatalog,
  patchStaffScheduleRemote,
} from '../../data/calendarCatalogApi.js'

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_LABEL = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

function todayKey() {
  return DAY_KEYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]
}

/**
 * Patch-only calendar control: stylists with canSelfManage can edit today's lunch.
 * Owners still use Settings → Stylist schedules for full control.
 */
export default function MyScheduleQuickEdit() {
  const dispatch = useDispatch()
  const me = useSelector(selectMe)
  const [open, setOpen] = useState(false)
  const [row, setRow] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [lunchStart, setLunchStart] = useState('12:00')
  const [lunchEnd, setLunchEnd] = useState('13:00')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const dayKey = useMemo(() => todayKey(), [])

  const load = useCallback(async () => {
    try {
      const userId = me?.user?.id
      if (!userId) return
      const catalog = await fetchStaffCatalog()
      if (!catalog) return
      setUpdatedAt(catalog.updatedAt || null)
      const staff = Array.isArray(catalog.staff) ? catalog.staff : []
      const mine = staff.find((s) => String(s.userId || '') === String(userId))
      if (!mine?.canSelfManage) {
        setRow(null)
        return
      }
      setRow(mine)
      const br = mine.breaks?.[dayKey]
      const win = Array.isArray(br) ? br[0] : null
      if (win?.start) setLunchStart(win.start)
      if (win?.end) setLunchEnd(win.end)
    } catch {
      setRow(null)
    }
  }, [dayKey, me])

  useEffect(() => {
    void dispatch(fetchMe())
  }, [dispatch])

  useEffect(() => {
    load()
  }, [load])

  async function save() {
    if (!row?.id) return
    setBusy(true)
    setError('')
    setMsg('')
    try {
      const breaks = { ...(row.breaks && typeof row.breaks === 'object' ? row.breaks : {}) }
      breaks[dayKey] = [{ start: lunchStart, end: lunchEnd }]
      const saved = await patchStaffScheduleRemote(row.id, {
        breaks,
        expectedUpdatedAt: updatedAt,
      })
      setUpdatedAt(saved.updatedAt || null)
      const next = (saved.staff || []).find((s) => String(s.id) === String(row.id))
      if (next) setRow(next)
      setMsg('Lunch updated')
    } catch (e) {
      setError(e.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  if (!row) return null

  return (
    <div className="cal-mysched">
      <button
        type="button"
        className="cal-mysched__toggle"
        onClick={() => setOpen((o) => !o)}
      >
        My lunch ({DAY_LABEL[dayKey]})
      </button>
      {open ? (
        <div className="cal-mysched__panel">
          <label className="cal-mysched__field">
            <span>Start</span>
            <input
              type="time"
              value={lunchStart}
              onChange={(e) => setLunchStart(e.target.value)}
            />
          </label>
          <label className="cal-mysched__field">
            <span>End</span>
            <input
              type="time"
              value={lunchEnd}
              onChange={(e) => setLunchEnd(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="cal-mysched__save"
            disabled={busy}
            onClick={save}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          {msg ? <p className="cal-mysched__ok">{msg}</p> : null}
          {error ? <p className="cal-mysched__err">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
