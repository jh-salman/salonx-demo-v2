function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function StaffPicker({ staff, value, onChange }) {
  const list = Array.isArray(staff) ? staff : []
  return (
    <div className="ms-bk-cards" role="listbox" aria-label="Professional">
      <button
        type="button"
        role="option"
        aria-selected={!value}
        className={`ms-bk-card ms-bk-staff${!value ? ' is-active' : ''}`}
        onClick={() => onChange('')}
      >
        <span className="ms-bk-staff__avatar ms-bk-staff__avatar--star" aria-hidden>
          ★
        </span>
        <span className="ms-bk-staff__main">
          <span className="ms-bk-staff__name">First available</span>
          <span className="ms-bk-staff__meta">Earliest open time</span>
        </span>
        <span className="ms-bk-card__radio" aria-hidden />
      </button>

      {list.map((s) => {
        const id = String(s.id)
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            role="option"
            aria-selected={active}
            className={`ms-bk-card ms-bk-staff${active ? ' is-active' : ''}`}
            onClick={() => onChange(id)}
          >
            {s.avatar ? (
              <img className="ms-bk-staff__avatar" src={s.avatar} alt="" />
            ) : (
              <span className="ms-bk-staff__avatar" aria-hidden>
                {initials(s.name)}
              </span>
            )}
            <span className="ms-bk-staff__main">
              <span className="ms-bk-staff__name">{s.name || 'Stylist'}</span>
              {s.role || s.title ? (
                <span className="ms-bk-staff__meta">{s.role || s.title}</span>
              ) : null}
            </span>
            <span className="ms-bk-card__radio" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
