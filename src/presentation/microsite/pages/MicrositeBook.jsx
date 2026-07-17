import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MicrositeShell from '../MicrositeShell'
import ServicePicker from '../components/ServicePicker'
import StaffPicker from '../components/StaffPicker'
import SlotPicker from '../components/SlotPicker'
import ClientInfoForm from '../components/ClientInfoForm'
import { micrositeApi, micrositePublicPath } from '../micrositeApi'

function todayISODate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const STEPS = ['Service', 'Stylist', 'Time', 'You']

export default function MicrositeBook() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [salon, setSalon] = useState(null)
  const [services, setServices] = useState([])
  const [staff, setStaff] = useState([])
  const [step, setStep] = useState(0)
  const [serviceId, setServiceId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [date, setDate] = useState(todayISODate)
  const [slots, setSlots] = useState([])
  const [slot, setSlot] = useState(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([
      micrositeApi.getPublicSalon(slug),
      micrositeApi.getServices(slug),
      micrositeApi.getStaff(slug),
    ])
      .then(([s, svc, st]) => {
        if (!alive) return
        setSalon(s.salon)
        setServices(svc.services || [])
        setStaff(st.staff || [])
        const first = svc.services?.[0]
        if (first?.id) setServiceId(String(first.id))
      })
      .catch((e) => {
        if (alive) setError(e.message || 'Failed to load')
      })
    return () => {
      alive = false
    }
  }, [slug])

  const loadSlots = useCallback(() => {
    if (!slug || !date) return
    setSlotsLoading(true)
    micrositeApi
      .getAvailability(slug, {
        date,
        serviceId: serviceId || undefined,
        staffId: staffId || undefined,
      })
      .then((data) => {
        setSlots(data.slots || [])
        setSlot(null)
      })
      .catch((e) => setError(e.message || 'Availability failed'))
      .finally(() => setSlotsLoading(false))
  }, [slug, date, serviceId, staffId])

  useEffect(() => {
    if (step === 2) loadSlots()
  }, [step, loadSlots])

  const canNext = useMemo(() => {
    if (step === 0) return Boolean(serviceId)
    if (step === 1) return true
    if (step === 2) return Boolean(slot?.start && slot?.end)
    if (step === 3) return Boolean(clientName.trim() && clientPhone.trim())
    return false
  }, [step, serviceId, slot, clientName, clientPhone])

  async function submit() {
    if (!slot) return
    setBusy(true)
    setError('')
    try {
      await micrositeApi.book(slug, {
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        serviceId: serviceId || undefined,
        staffId: staffId || slot.staffId || null,
        start: slot.start,
        end: slot.end,
      })
      navigate(micrositePublicPath(slug, 'success'), {
        state: { clientName: clientName.trim() },
      })
    } catch (e) {
      setError(e.message || 'Booking failed')
    } finally {
      setBusy(false)
    }
  }

  if (error && !salon) {
    return (
      <div className="ms-shell">
        <div className="ms-shell__inner ms-center">
          <h1>Unavailable</h1>
          <p className="ms-muted">{error}</p>
        </div>
      </div>
    )
  }

  if (!salon) {
    return (
      <div className="ms-shell">
        <div className="ms-shell__inner ms-center">
          <p className="ms-muted">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <MicrositeShell salon={salon}>
      <div className="ms-book">
        <div className="ms-book__header">
          <Link className="ms-back" to={micrositePublicPath(slug)}>
            ← {salon.name}
          </Link>
          <h1 className="ms-book__title">Book</h1>
          <div className="ms-steps" aria-label="Steps">
            {STEPS.map((label, i) => (
              <span key={label} className={`ms-steps__item${i === step ? ' is-active' : ''}`}>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="ms-book__body">
          {step === 0 ? (
            <ServicePicker
              services={services}
              value={serviceId}
              onChange={setServiceId}
            />
          ) : null}
          {step === 1 ? (
            <StaffPicker staff={staff} value={staffId} onChange={setStaffId} />
          ) : null}
          {step === 2 ? (
            <SlotPicker
              date={date}
              onDateChange={setDate}
              slots={slots}
              value={slot}
              onChange={setSlot}
              loading={slotsLoading}
            />
          ) : null}
          {step === 3 ? (
            <ClientInfoForm
              clientName={clientName}
              clientPhone={clientPhone}
              onChange={(patch) => {
                if (patch.clientName !== undefined) setClientName(patch.clientName)
                if (patch.clientPhone !== undefined) setClientPhone(patch.clientPhone)
              }}
            />
          ) : null}

          {error ? <p className="ms-error">{error}</p> : null}
        </div>

        <div className="ms-book__actions">
          {step > 0 ? (
            <button
              type="button"
              className="ms-btn ms-btn--ghost"
              onClick={() => setStep((s) => s - 1)}
            >
              Back
            </button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="ms-btn ms-btn--primary"
              disabled={!canNext}
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="ms-btn ms-btn--primary"
              disabled={!canNext || busy}
              onClick={submit}
            >
              {busy ? 'Booking…' : 'Confirm'}
            </button>
          )}
        </div>
      </div>
    </MicrositeShell>
  )
}
