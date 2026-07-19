import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MicrositeShell from '../MicrositeShell'
import ServicePicker from '../components/ServicePicker'
import AddOnPicker from '../components/AddOnPicker'
import StaffPicker from '../components/StaffPicker'
import SlotPicker from '../components/SlotPicker'
import ClientInfoForm from '../components/ClientInfoForm'
import { micrositeApi, micrositePublicPath } from '../micrositeApi'
import { useMicrositeSlug } from '../useMicrositeSlug'
import { cartTotals, durationLabel, priceLabel, splitCatalog } from '../micrositeCatalog'

function todayISODate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const STEP_TITLES = {
  service: 'Select services',
  addons: 'Add extras',
  staff: 'Choose your professional',
  time: 'Pick a time',
  details: 'Your details',
}

const STEP_LABELS = {
  service: 'Services',
  addons: 'Extras',
  staff: 'Pro',
  time: 'Time',
  details: 'Details',
}

export default function MicrositeBook() {
  const slug = useMicrositeSlug()
  const navigate = useNavigate()

  const [salon, setSalon] = useState(null)
  const [rawServices, setRawServices] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [step, setStep] = useState(0)
  const [serviceIds, setServiceIds] = useState([])
  const [addOnIds, setAddOnIds] = useState([])
  const [staffId, setStaffId] = useState('')
  const [date, setDate] = useState(todayISODate)
  const [slots, setSlots] = useState([])
  const [slot, setSlot] = useState(null)
  const [slotsLoading, setSlotsLoading] = useState(false)

  const [client, setClient] = useState({
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    notes: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { main: services, addOns } = useMemo(
    () => splitCatalog(rawServices),
    [rawServices],
  )

  const steps = useMemo(() => {
    const s = ['service']
    if (addOns.length) s.push('addons')
    s.push('staff', 'time', 'details')
    return s
  }, [addOns.length])

  const stepKey = steps[Math.min(step, steps.length - 1)]

  const loadAll = useCallback(() => {
    if (!slug) {
      setLoadError('Salon not found')
      setLoading(false)
      return undefined
    }
    let alive = true
    setLoading(true)
    setLoadError('')
    Promise.all([
      micrositeApi.getPublicSalon(slug),
      micrositeApi.getServices(slug),
      micrositeApi.getStaff(slug),
    ])
      .then(([s, svc, st]) => {
        if (!alive) return
        setSalon(s.salon)
        setRawServices(svc.services || [])
        setStaff(st.staff || [])
      })
      .catch((e) => {
        if (alive) setLoadError(e.message || 'Failed to load')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [slug])

  useEffect(() => loadAll(), [loadAll])

  const byId = useMemo(() => {
    const m = new Map()
    for (const s of [...services, ...addOns]) m.set(String(s.id), s)
    return m
  }, [services, addOns])

  const cart = useMemo(
    () =>
      cartTotals({
        services,
        addOns,
        selectedServiceIds: serviceIds,
        selectedAddOnIds: addOnIds,
      }),
    [services, addOns, serviceIds, addOnIds],
  )

  const primaryServiceId = serviceIds[0] || ''

  const loadSlots = useCallback(() => {
    if (!slug || !date) return
    setSlotsLoading(true)
    micrositeApi
      .getAvailability(slug, {
        date,
        serviceId: primaryServiceId || undefined,
        staffId: staffId || undefined,
      })
      .then((data) => {
        setSlots(data.slots || [])
        setSlot(null)
      })
      .catch((e) => setError(e.message || 'Availability failed'))
      .finally(() => setSlotsLoading(false))
  }, [slug, date, primaryServiceId, staffId])

  useEffect(() => {
    if (stepKey === 'time') loadSlots()
  }, [stepKey, loadSlots])

  function toggleService(id) {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }
  function toggleAddOn(id) {
    setAddOnIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const canNext = useMemo(() => {
    if (stepKey === 'service') return serviceIds.length > 0
    if (stepKey === 'addons') return true
    if (stepKey === 'staff') return true
    if (stepKey === 'time') return Boolean(slot?.start)
    if (stepKey === 'details')
      return Boolean(client.clientName.trim() && client.clientPhone.trim())
    return false
  }, [stepKey, serviceIds, slot, client])

  const selectedStaff = useMemo(
    () => staff.find((s) => String(s.id) === staffId) || null,
    [staff, staffId],
  )

  async function submit() {
    if (!slot) return
    setBusy(true)
    setError('')
    try {
      const startD = new Date(slot.start)
      const endD = new Date(startD.getTime() + Math.max(cart.duration, 15) * 60_000)

      const serviceNames = serviceIds.map((id) => byId.get(id)?.name).filter(Boolean)
      const addOnNames = addOnIds.map((id) => byId.get(id)?.name).filter(Boolean)
      const summary = [
        serviceNames.length ? serviceNames.join(', ') : '',
        addOnNames.length ? `Add-ons: ${addOnNames.join(', ')}` : '',
        `Total ${priceLabel(cart.price)} · ${durationLabel(cart.duration)}`,
      ]
        .filter(Boolean)
        .join(' — ')
      const note = [summary, client.notes.trim()].filter(Boolean).join(' — ')

      await micrositeApi.book(slug, {
        clientName: client.clientName.trim(),
        clientPhone: client.clientPhone.trim(),
        clientEmail: client.clientEmail.trim() || undefined,
        notes: note || undefined,
        serviceId: primaryServiceId || undefined,
        staffId: staffId || slot.staffId || null,
        start: startD.toISOString(),
        end: endD.toISOString(),
      })
      navigate(micrositePublicPath(slug, 'success'), {
        state: { clientName: client.clientName.trim() },
      })
    } catch (e) {
      setError(e.message || 'Booking failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <MicrositeShell salon={salon || { slug, templateId: 'sx-book-v1' }}>
        <div className="ms-book">
          <div className="ms-book__header">
            <div className="ms-bk-skeleton ms-bk-skeleton--title" />
          </div>
          <div className="ms-book__body">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="ms-bk-skeleton ms-bk-skeleton--card" />
            ))}
          </div>
        </div>
      </MicrositeShell>
    )
  }

  if (loadError) {
    return (
      <MicrositeShell salon={salon || { slug, templateId: 'sx-book-v1' }}>
        <div className="ms-book">
          <div className="ms-book__body ms-center">
            <h1 className="ms-bk-error-title">Can&apos;t load booking</h1>
            <p className="ms-muted">{loadError}</p>
            <button type="button" className="ms-btn ms-btn--primary" onClick={loadAll}>
              Try again
            </button>
            <Link className="ms-back" to={micrositePublicPath(slug)}>
              ← Back to home
            </Link>
          </div>
        </div>
      </MicrositeShell>
    )
  }

  return (
    <MicrositeShell salon={salon}>
      <div className="ms-book">
        <div className="ms-book__header">
          <Link className="ms-back" to={micrositePublicPath(slug)}>
            ← {salon?.name}
          </Link>
          <h1 className="ms-book__title">{STEP_TITLES[stepKey]}</h1>
          <div className="ms-bk-steps" aria-label="Progress">
            {steps.map((key, i) => (
              <span
                key={key}
                className={`ms-bk-steps__item${i === step ? ' is-active' : ''}${
                  i < step ? ' is-done' : ''
                }`}
              >
                <i className="ms-bk-steps__dot" />
                <span className="ms-bk-steps__txt">{STEP_LABELS[key]}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="ms-book__body">
          {stepKey === 'service' ? (
            <ServicePicker
              services={services}
              selectedIds={serviceIds}
              onToggle={toggleService}
            />
          ) : null}

          {stepKey === 'addons' ? (
            <AddOnPicker
              addOns={addOns}
              selectedIds={addOnIds}
              onToggle={toggleAddOn}
            />
          ) : null}

          {stepKey === 'staff' ? (
            <StaffPicker staff={staff} value={staffId} onChange={setStaffId} />
          ) : null}

          {stepKey === 'time' ? (
            <SlotPicker
              date={date}
              onDateChange={setDate}
              slots={slots}
              value={slot}
              onChange={setSlot}
              loading={slotsLoading}
            />
          ) : null}

          {stepKey === 'details' ? (
            <>
              <div className="ms-bk-review">
                {serviceIds.map((id) => {
                  const s = byId.get(id)
                  if (!s) return null
                  return (
                    <div key={id} className="ms-bk-review__row">
                      <span>{s.name}</span>
                      <strong>{priceLabel(s.price)}</strong>
                    </div>
                  )
                })}
                {addOnIds.map((id) => {
                  const s = byId.get(id)
                  if (!s) return null
                  return (
                    <div key={id} className="ms-bk-review__row">
                      <span>+ {s.name}</span>
                      <strong>{priceLabel(s.price)}</strong>
                    </div>
                  )
                })}
                <div className="ms-bk-review__row">
                  <span>Professional</span>
                  <strong>{selectedStaff?.name || 'First available'}</strong>
                </div>
                <div className="ms-bk-review__row">
                  <span>When</span>
                  <strong>{slot ? formatWhen(slot.start) : '—'}</strong>
                </div>
                <div className="ms-bk-review__row ms-bk-review__row--total">
                  <span>Total · {durationLabel(cart.duration)}</span>
                  <strong>{priceLabel(cart.price)}</strong>
                </div>
              </div>
              <ClientInfoForm
                clientName={client.clientName}
                clientPhone={client.clientPhone}
                clientEmail={client.clientEmail}
                notes={client.notes}
                onChange={(patch) => setClient((c) => ({ ...c, ...patch }))}
              />
            </>
          ) : null}

          {error ? <p className="ms-error">{error}</p> : null}
        </div>

        <div className="ms-book__footer">
          {cart.count > 0 && stepKey !== 'details' ? (
            <div className="ms-bk-cartbar">
              <span className="ms-bk-cartbar__count">
                {cart.count} {cart.count === 1 ? 'item' : 'items'}
                {cart.duration ? ` · ${durationLabel(cart.duration)}` : ''}
              </span>
              <span className="ms-bk-cartbar__total">{priceLabel(cart.price)}</span>
            </div>
          ) : null}
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
            {step < steps.length - 1 ? (
              <button
                type="button"
                className="ms-btn ms-btn--primary"
                disabled={!canNext}
                onClick={() => setStep((s) => s + 1)}
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                className="ms-btn ms-btn--primary"
                disabled={!canNext || busy}
                onClick={submit}
              >
                {busy ? 'Booking…' : 'Confirm booking'}
              </button>
            )}
          </div>
        </div>
      </div>
    </MicrositeShell>
  )
}
