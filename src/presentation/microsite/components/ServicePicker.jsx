import { useState } from 'react'
import {
  buildServiceCategories,
  durationLabel,
  priceLabel,
  serviceDuration,
} from '../micrositeCatalog'

export default function ServicePicker({ services, selectedIds = [], onToggle }) {
  const categories = buildServiceCategories(services)
  const selected = new Set(selectedIds.map(String))
  const [collapsed, setCollapsed] = useState(() => new Set())

  if (!categories.length) {
    return <p className="ms-muted ms-bk-empty">No services available yet.</p>
  }

  function toggleSection(name) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="ms-bk-cats">
      {categories.map(({ name, items }) => {
        const isCollapsed = collapsed.has(name)
        const pickedInCat = items.filter((s) => selected.has(String(s.id))).length
        return (
          <section key={name} className="ms-bk-cat">
            <button
              type="button"
              className="ms-bk-cat__head"
              aria-expanded={!isCollapsed}
              onClick={() => toggleSection(name)}
            >
              <span className="ms-bk-cat__name">{name}</span>
              <span className="ms-bk-cat__right">
                {pickedInCat ? (
                  <span className="ms-bk-cat__count">{pickedInCat}</span>
                ) : null}
                <span
                  className={`ms-bk-cat__caret${isCollapsed ? '' : ' is-open'}`}
                  aria-hidden
                >
                  ›
                </span>
              </span>
            </button>

            {!isCollapsed ? (
              <div className="ms-bk-cards" role="group" aria-label={name}>
                {items.map((s) => {
                  const id = String(s.id)
                  const active = selected.has(id)
                  const dur = durationLabel(serviceDuration(s))
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={active}
                      className={`ms-bk-card ms-bk-service${active ? ' is-active' : ''}`}
                      onClick={() => onToggle(id)}
                    >
                      <span className="ms-bk-service__main">
                        <span className="ms-bk-service__name">
                          {s.name || 'Service'}
                        </span>
                        <span className="ms-bk-service__meta">
                          {dur ? <span>{dur}</span> : null}
                          {typeof s.price === 'number' ? (
                            <span className="ms-bk-service__price">
                              {priceLabel(s.price)}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span
                        className={`ms-bk-check${active ? ' is-active' : ''}`}
                        aria-hidden
                      >
                        {active ? '✓' : '+'}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
