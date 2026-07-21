import { useCallback, useEffect, useState } from 'react'
import {
  fetchPendingReferenceReviews,
  updateAppointmentRemote,
} from '../../data/v2AppointmentsApi.js'

const SESSION_KEY = 'salonx.refReviewPopup.dismissed'

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleString([], {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/**
 * #11 — On calendar load, alert the stylist about upcoming appointments that
 * carry a new (unreviewed) client reference image. Reviewing opens the image
 * and marks it reviewed so the glass badge clears.
 */
export default function ReferenceReviewPopup() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    if (sessionStorage.getItem(SESSION_KEY) === '1') return
    try {
      const list = await fetchPendingReferenceReviews()
      if (Array.isArray(list) && list.length > 0) {
        setItems(list)
        setOpen(true)
      }
    } catch {
      /* silent — non-critical */
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, '1')
    setOpen(false)
  }

  async function review(apt) {
    try {
      if (apt.referenceImageUrl) {
        window.open(apt.referenceImageUrl, '_blank', 'noopener')
      }
      await updateAppointmentRemote(apt.id, { markReferenceReviewed: true })
    } catch {
      /* ignore */
    }
    setItems((prev) => {
      const next = prev.filter((a) => a.id !== apt.id)
      if (next.length === 0) {
        sessionStorage.setItem(SESSION_KEY, '1')
        setOpen(false)
      }
      return next
    })
  }

  if (!open || items.length === 0) return null

  return (
    <div className="ref-pop__scrim" role="dialog" aria-modal="true">
      <div className="ref-pop">
        <div className="ref-pop__head">
          <span className="ref-pop__cam" aria-hidden="true">📷</span>
          <div>
            <h3 className="ref-pop__title">New reference image{items.length > 1 ? 's' : ''}</h3>
            <p className="ref-pop__sub">
              {items.length} client{items.length > 1 ? 's' : ''} shared a look for an upcoming visit.
            </p>
          </div>
          <button type="button" className="ref-pop__x" onClick={dismiss} aria-label="Close">
            ×
          </button>
        </div>
        <ul className="ref-pop__list">
          {items.map((apt) => (
            <li key={apt.id} className="ref-pop__item">
              {apt.referenceImageUrl ? (
                <img className="ref-pop__thumb" src={apt.referenceImageUrl} alt="Reference" />
              ) : (
                <span className="ref-pop__thumb ref-pop__thumb--empty">📷</span>
              )}
              <div className="ref-pop__meta">
                <strong>{apt.clientName || 'Client'}</strong>
                <span>{apt.service || 'Appointment'} · {fmtTime(apt.start)}</span>
              </div>
              <button
                type="button"
                className="ref-pop__review"
                onClick={() => review(apt)}
              >
                Review
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="ref-pop__later" onClick={dismiss}>
          Later
        </button>
      </div>
    </div>
  )
}
