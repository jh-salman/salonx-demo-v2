export default function ClientInfoForm({ clientName, clientPhone, onChange }) {
  return (
    <div className="ms-form">
      <label className="ms-field">
        <span>Your name</span>
        <input
          type="text"
          autoComplete="name"
          value={clientName}
          onChange={(e) => onChange({ clientName: e.target.value })}
          placeholder="Jane Doe"
        />
      </label>
      <label className="ms-field">
        <span>Phone</span>
        <input
          type="tel"
          autoComplete="tel"
          value={clientPhone}
          onChange={(e) => onChange({ clientPhone: e.target.value })}
          placeholder="+1 555 123 4567"
        />
      </label>
    </div>
  )
}
