export default function ServicePicker({ services, value, onChange }) {
  if (!services?.length) {
    return <p className="ms-muted">No services available yet.</p>
  }
  return (
    <div className="ms-list" role="listbox" aria-label="Services">
      {services.map((s) => {
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
            <span className="ms-list__title">{s.name || 'Service'}</span>
            {typeof s.price === 'number' ? (
              <span className="ms-list__meta">${s.price.toFixed(0)}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
