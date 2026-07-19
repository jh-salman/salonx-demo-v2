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

export default function SlotPicker({ date, onDateChange, slots, value, onChange, loading }) {
  const rail = buildDayRail(14)
  const groups = { Morning: [], Afternoon: [], Evening: [] }
  for (const s of slots || []) groups[partOfDay(s.start)].push(s)

  const hasSlots = (slots || []).length > 0

  return (
    <div className="ms-bk-time">
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
        <p className="ms-muted ms-bk-empty">No open times this day. Try another date.</p>
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
    </div>
  )
}
