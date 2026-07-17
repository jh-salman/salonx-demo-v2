export default function StaffPicker({ staff, value, onChange }) {
  if (!staff?.length) {
    return <p className="ms-muted">Any available stylist.</p>
  }
  return (
    <div className="ms-list" role="listbox" aria-label="Staff">
      <button
        type="button"
        role="option"
        aria-selected={!value}
        className={`ms-list__item${!value ? ' is-active' : ''}`}
        onClick={() => onChange('')}
      >
        <span className="ms-list__title">Anyone</span>
      </button>
      {staff.map((s) => {
        const id = String(s.id)
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            role="option"
            aria-selected={active}
            className={`ms-list__item${active ? ' is-active' : ''}`}
            onClick={() => onChange(id)}
          >
            <span className="ms-list__title">{s.name || 'Stylist'}</span>
          </button>
        )
      })}
    </div>
  )
}
