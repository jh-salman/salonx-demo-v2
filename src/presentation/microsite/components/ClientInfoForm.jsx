export default function ClientInfoForm({
  clientName,
  clientPhone,
  clientEmail = '',
  notes = '',
  referenceImageUrl = '',
  onChange,
  onPickImage,
  uploadingImage,
}) {
  return (
    <div className="ms-bk-form">
      <label className="ms-field">
        <span>Full name *</span>
        <input
          type="text"
          autoComplete="name"
          value={clientName}
          onChange={(e) => onChange({ clientName: e.target.value })}
          placeholder="Jane Doe"
        />
      </label>
      <label className="ms-field">
        <span>Cell phone *</span>
        <input
          type="tel"
          autoComplete="tel"
          value={clientPhone}
          onChange={(e) => onChange({ clientPhone: e.target.value })}
          placeholder="(555) 123-4567"
        />
        <span className="ms-field__hint">
          We&apos;ll text you a confirmation and reminder.
        </span>
      </label>
      <label className="ms-field">
        <span>Email (optional)</span>
        <input
          type="email"
          autoComplete="email"
          value={clientEmail}
          onChange={(e) => onChange({ clientEmail: e.target.value })}
          placeholder="jane@email.com"
        />
      </label>
      <label className="ms-field">
        <span>Add a note (optional)</span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Anything we should know?"
        />
      </label>
      <label className="ms-field">
        <span>Reference image (optional)</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onPickImage?.(file)
          }}
        />
        <span className="ms-field__hint">
          Show your stylist what you&apos;re expecting — one image.
        </span>
        {uploadingImage ? <span className="ms-muted">Uploading…</span> : null}
        {referenceImageUrl ? (
          <img
            className="ms-bk-refpreview"
            src={referenceImageUrl}
            alt="Reference"
          />
        ) : null}
      </label>
    </div>
  )
}
