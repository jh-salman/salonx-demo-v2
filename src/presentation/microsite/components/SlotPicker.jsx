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

export default function SlotPicker({ date, onDateChange, slots, value, onChange, loading }) {
  return (
    <div className="ms-slots">
      <label className="ms-field">
        <span>Date</span>
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </label>
      {loading ? <p className="ms-muted">Loading times…</p> : null}
      {!loading && !slots?.length ? (
        <p className="ms-muted">No open times this day.</p>
      ) : null}
      <div className="ms-slots__grid">
        {(slots || []).map((s) => {
          const active = value?.start === s.start
          return (
            <button
              key={`${s.start}-${s.staffId || 'any'}`}
              type="button"
              className={`ms-chip${active ? ' is-active' : ''}`}
              onClick={() => onChange(s)}
            >
              {formatSlot(s.start)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
