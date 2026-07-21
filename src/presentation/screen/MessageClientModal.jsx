import { useEffect, useState } from 'react'
import { sendAppointmentMessage } from '../../data/v2AppointmentsApi.js'

const QUICK = [
  'Please arrive 10 minutes early.',
  'Looking forward to seeing you! Reply here if anything changes.',
  'Please come with clean, dry hair.',
]

/**
 * #9 — Staff → client note/SMS after booking. Sends via demo-api → sent.dm and
 * logs to SalonxClientMessage. Requires the appointment to carry a client phone.
 */
export default function MessageClientModal({ apt, onClose }) {
  const [text, setText] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setText('')
    setPhone(apt?.clientPhone || '')
    setResult(null)
    setError('')
  }, [apt])

  if (!apt) return null

  async function send() {
    const body = text.trim()
    if (!body) {
      setError('Write a message first')
      return
    }
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const payload = { body }
      if (phone.trim()) payload.clientPhone = phone.trim()
      const res = await sendAppointmentMessage(apt.id, payload)
      const status = res?.message?.status
      if (status === 'sent') setResult('Message sent')
      else if (status === 'queued') setResult('Queued — SMS provider not configured yet')
      else setResult(res?.message?.error || 'Could not deliver')
    } catch (e) {
      setError(e.message || 'Send failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cal-modal" role="dialog" aria-modal="true">
      <button
        type="button"
        className="cal-modal__backdrop"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="cal-modal__card msgc">
        <div className="cal-modal__title">Message {apt.clientName || 'client'}</div>
        <div className="cal-modal__subtitle">Send a quick note by SMS</div>

        {!apt.clientPhone ? (
          <label className="msgc__field">
            <span>Client phone</span>
            <input
              type="tel"
              placeholder="+1 555 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
        ) : null}

        <textarea
          className="msgc__text"
          rows={3}
          placeholder="Please arrive 10 minutes early."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="msgc__quick">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              className="msgc__chip"
              onClick={() => setText(q)}
            >
              {q.length > 28 ? `${q.slice(0, 28)}…` : q}
            </button>
          ))}
        </div>

        {result ? <p className="msgc__ok">{result}</p> : null}
        {error ? <p className="msgc__err">{error}</p> : null}

        <button
          type="button"
          className="cal-modal__btn msgc__send"
          disabled={busy}
          onClick={send}
        >
          {busy ? 'Sending…' : 'Send message'}
        </button>
        <button type="button" className="cal-modal__close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
