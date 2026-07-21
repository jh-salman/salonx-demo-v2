import { useMemo, useState } from 'react'

function pad(n) {
  return String(n).padStart(2, '0')
}

function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Next `count` days from today for the horizontal day rail. */
function buildDayRail(count = 14) {
  const days = []
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    days.push(d)
  }
  return days
}

function formatSlot(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function partOfDay(iso) {
  const h = new Date(iso).getHours()
  if (h < 12) return 'Morning'
  if (h < 17) return 'Afternoon'
  return 'Evening'
}

const GROUP_ORDER = ['Morning', 'Afternoon', 'Evening']
const WINDOW_KEYS = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
]

export default function SlotPicker({
  date,
  onDateChange,
  slots,
  value,
  onChange,
  loading,
  onSmartFind,
  smartLoading,
  smartMiss,
  onJoinWaitlist,
}) {
  const rail = buildDayRail(14)
  const groups = { Morning: [], Afternoon: [], Evening: [] }
  for (const s of slots || []) groups[partOfDay(s.start)].push(s)

  const hasSlots = (slots || []).length > 0
  const [mode, setMode] = useState('pick') // pick | smart
  const [smartWindow, setSmartWindow] = useState('afternoon')
  const [smartDates, setSmartDates] = useState(() => [toISODate(new Date())])

  const smartDateSet = useMemo(() => new Set(smartDates), [smartDates])

  function toggleSmartDate(iso) {
    setSmartDates((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].slice(0, 7),
    )
  }

  return (
    <div className="ms-bk-time">
      <div className="ms-bk-mode">
        <button
          type="button"
          className={`ms-bk-mode__btn${mode === 'pick' ? ' is-active' : ''}`}
          onClick={() => setMode('pick')}
        >
          Pick a time
        </button>
        <button
          type="button"
          className={`ms-bk-mode__btn${mode === 'smart' ? ' is-active' : ''}`}
          onClick={() => setMode('smart')}
        >
          Find best time
        </button>
      </div>

      {mode === 'smart' ? (
        <div className="ms-bk-smart">
          <p className="ms-muted ms-bk-smart__hint">
            Choose a few days and a part of day — we&apos;ll find the earliest open slot.
          </p>
          <div className="ms-bk-dayrail" role="group" aria-label="Preferred days">
            {rail.slice(0, 7).map((d) => {
              const iso = toISODate(d)
              const active = smartDateSet.has(iso)
              return (
                <button
                  key={iso}
                  type="button"
                  className={`ms-bk-day${active ? ' is-active' : ''}`}
                  onClick={() => toggleSmartDate(iso)}
                >
                  <span className="ms-bk-day__dow">
                    {d.toLocaleDateString([], { weekday: 'short' })}
                  </span>
                  <span className="ms-bk-day__num">{d.getDate()}</span>
                  <span className="ms-bk-day__mon">
                    {d.toLocaleDateString([], { month: 'short' })}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="ms-bk-chips ms-bk-chips--windows">
            {WINDOW_KEYS.map((w) => (
              <button
                key={w.id}
                type="button"
                className={`ms-bk-chip${smartWindow === w.id ? ' is-active' : ''}`}
                onClick={() => setSmartWindow(w.id)}
              >
                {w.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ms-btn ms-btn--primary"
            disabled={!smartDates.length || smartLoading}
            onClick={() => onSmartFind?.({ dates: smartDates, window: smartWindow })}
          >
            {smartLoading ? 'Searching…' : 'Find earliest'}
          </button>
          {smartMiss ? (
            <div className="ms-bk-smart__miss">
              <p className="ms-muted">
                No open times in that window. Join our waiting list and we&apos;ll follow up.
              </p>
              {onJoinWaitlist ? (
                <button
                  type="button"
                  className="ms-btn ms-btn--ghost"
                  onClick={onJoinWaitlist}
                >
                  Join waiting list
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="ms-bk-dayrail" role="tablist" aria-label="Select day">
            {rail.map((d) => {
              const iso = toISODate(d)
              const active = iso === date
              return (
                <button
                  key={iso}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`ms-bk-day${active ? ' is-active' : ''}`}
                  onClick={() => onDateChange(iso)}
                >
                  <span className="ms-bk-day__dow">
                    {d.toLocaleDateString([], { weekday: 'short' })}
                  </span>
                  <span className="ms-bk-day__num">{d.getDate()}</span>
                  <span className="ms-bk-day__mon">
                    {d.toLocaleDateString([], { month: 'short' })}
                  </span>
                </button>
              )
            })}
          </div>

          {loading ? (
            <div className="ms-bk-slotgroup">
              <div className="ms-bk-chips">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className="ms-bk-chip ms-bk-chip--skeleton" />
                ))}
              </div>
            </div>
          ) : null}

          {!loading && !hasSlots ? (
            <div className="ms-bk-smart__miss">
              <p className="ms-muted ms-bk-empty">
                No open times this day. Try another date, or join the waiting list.
              </p>
              {onJoinWaitlist ? (
                <button
                  type="button"
                  className="ms-btn ms-btn--ghost"
                  onClick={onJoinWaitlist}
                >
                  Join waiting list
                </button>
              ) : null}
            </div>
          ) : null}

          {!loading && hasSlots
            ? GROUP_ORDER.map((label) =>
                groups[label].length ? (
                  <div key={label} className="ms-bk-slotgroup">
                    <div className="ms-bk-slotgroup__label">{label}</div>
                    <div className="ms-bk-chips">
                      {groups[label].map((s) => {
                        const active = value?.start === s.start
                        return (
                          <button
                            key={`${s.start}-${s.staffId || 'any'}`}
                            type="button"
                            className={`ms-bk-chip${active ? ' is-active' : ''}`}
                            onClick={() => onChange(s)}
                          >
                            {formatSlot(s.start)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null,
              )
            : null}
        </>
      )}
    </div>
  )
}
