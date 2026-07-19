import {
  DEFAULT_ADDON_MIN,
  durationLabel,
  priceLabel,
  serviceDuration,
} from '../micrositeCatalog'

export default function AddOnPicker({ addOns, selectedIds = [], onToggle }) {
  const selected = new Set(selectedIds.map(String))
  if (!addOns?.length) {
    return <p className="ms-muted ms-bk-empty">No add-ons for this visit.</p>
  }
  return (
    <div className="ms-bk-cards" role="group" aria-label="Add-ons">
      {addOns.map((s) => {
        const id = String(s.id)
        const active = selected.has(id)
        const dur = durationLabel(serviceDuration(s, DEFAULT_ADDON_MIN))
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            className={`ms-bk-card ms-bk-service${active ? ' is-active' : ''}`}
            onClick={() => onToggle(id)}
          >
            <span className="ms-bk-service__main">
              <span className="ms-bk-service__name">{s.name || 'Add-on'}</span>
              <span className="ms-bk-service__meta">
                {dur ? <span>{dur}</span> : null}
                {typeof s.price === 'number' ? (
                  <span className="ms-bk-service__price">{priceLabel(s.price)}</span>
                ) : null}
              </span>
            </span>
            <span className={`ms-bk-check${active ? ' is-active' : ''}`} aria-hidden>
              {active ? '✓' : '+'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
