import { useState } from 'react'

export default function WaitlistForm({
  clientName,
  clientPhone,
  preferredWindow,
  preferredDates,
  notes,
  onChange,
  onSubmit,
  busy,
}) {
  return (
    <div className="ms-bk-waitlist">
      <p className="ms-muted">
        If you cannot find a time and date that works best for you, join our waiting
        list and we&apos;ll follow up.
      </p>
      <div className="ms-bk-form">
        <label className="ms-field">
          <span>Full name *</span>
          <input
            type="text"
            value={clientName}
            onChange={(e) => onChange({ clientName: e.target.value })}
            placeholder="Jane Doe"
          />
        </label>
        <label className="ms-field">
          <span>Cell phone *</span>
          <input
            type="tel"
            value={clientPhone}
            onChange={(e) => onChange({ clientPhone: e.target.value })}
            placeholder="(555) 123-4567"
          />
        </label>
        <label className="ms-field">
          <span>Preferred window</span>
          <select
            value={preferredWindow || ''}
            onChange={(e) => onChange({ preferredWindow: e.target.value })}
          >
            <option value="">Any</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </select>
        </label>
        <label className="ms-field">
          <span>Preferred dates (optional)</span>
          <input
            type="text"
            value={(preferredDates || []).join(', ')}
            onChange={(e) =>
              onChange({
                preferredDates: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="2026-07-21, 2026-07-22"
          />
        </label>
        <label className="ms-field">
          <span>Note (optional)</span>
          <textarea
            rows={3}
            value={notes || ''}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Anything we should know?"
          />
        </label>
      </div>
      <button
        type="button"
        className="ms-btn ms-btn--primary"
        disabled={busy || !clientName.trim() || !clientPhone.trim()}
        onClick={onSubmit}
      >
        {busy ? 'Joining…' : 'Join waiting list'}
      </button>
    </div>
  )
}
