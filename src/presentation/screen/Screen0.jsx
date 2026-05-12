import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readMarqueePersisted } from '../../sync/v2AdminBootstrap.js'
import { writeDemoLoginPhone } from '../../lib/demoLoginPhone.js'
import '../style/screen0.css'

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '').slice(0, 10)
}

/** US-style display while storing 10 digits only. */
function formatPhoneDisplay(digits) {
  const d = digitsOnly(digits)
  if (d.length === 0) return ''
  if (d.length <= 3) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

function urlLooksLikeVideo(url) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(String(url || ''))
}

/** After Rock Star: hide phone chrome; full-bleed video ~this long before route (boss demo). */
const SCREEN0_POST_ROCKSTAR_HOLD_MS = 3000

function Screen0() {
  const navigate = useNavigate()
  const rootRef = useRef(null)
  const marqueeVideoRef = useRef(null)
  const postRockStarNavTimerRef = useRef(null)
  const [marquee, setMarquee] = useState(() => readMarqueePersisted())
  const [step, setStep] = useState('landing')
  const [phone, setPhone] = useState('')
  const [phoneFocused, setPhoneFocused] = useState(false)
  const [entering, setEntering] = useState(false)
  /** Hero URL 404 / decode error / video fail — show gradient fallback only. */
  const [mediaFailed, setMediaFailed] = useState(false)

  useEffect(() => {
    const onSync = () => setMarquee(readMarqueePersisted())
    window.addEventListener('salonx:v2admin-marquee', onSync)
    return () => window.removeEventListener('salonx:v2admin-marquee', onSync)
  }, [])

  const customSrc = marquee?.image?.trim() ?? ''

  useEffect(() => {
    setMediaFailed(false)
  }, [customSrc])

  const isVideo =
    Boolean(customSrc) &&
    (marquee?.mediaKind === 'video' || urlLooksLikeVideo(customSrc))
  const adjust = marquee?.adjust ?? {
    scale: 1,
    rotate: 0,
    tx: 0,
    ty: 0,
    fit: 'cover',
  }
  /* Full-bleed: no tx/ty — slot-editor pans look like side gaps with object-fit: cover. */
  const transform = `translate(0%, 0%) rotate(${adjust.rotate}deg) scale(${adjust.scale})`

  const showVideoLayer =
    Boolean(customSrc) && !mediaFailed && isVideo
  const showImageLayer =
    Boolean(customSrc) && !mediaFailed && !isVideo

  /* Marquee video: keep playing on landing until Rock Star (boss demo) — do not pause/rewind on step. */
  useEffect(() => {
    const el = marqueeVideoRef.current
    if (!el || !isVideo) return
    void el.play().catch(() => {})
  }, [isVideo, customSrc])

  /** Lift bottom dock above the on-screen keyboard without rescaling the hero (uses visualViewport). */
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const updateKbLift = () => {
      const el = rootRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const visibleBottom = vv.offsetTop + vv.height
      const covered = Math.max(0, rect.bottom - visibleBottom)
      const h = Math.max(rect.height, 1)
      const oh = el.offsetHeight || 1
      const liftDesign = Math.ceil((covered / h) * oh)
      el.style.setProperty('--screen0-kb-lift', `${liftDesign}px`)
    }

    updateKbLift()
    vv.addEventListener('resize', updateKbLift)
    vv.addEventListener('scroll', updateKbLift)
    window.addEventListener('resize', updateKbLift)

    return () => {
      vv.removeEventListener('resize', updateKbLift)
      vv.removeEventListener('scroll', updateKbLift)
      window.removeEventListener('resize', updateKbLift)
      rootRef.current?.style.removeProperty('--screen0-kb-lift')
    }
  }, [])

  useEffect(
    () => () => {
      if (postRockStarNavTimerRef.current != null) {
        window.clearTimeout(postRockStarNavTimerRef.current)
        postRockStarNavTimerRef.current = null
      }
    },
    [],
  )

  const onPhoneChange = useCallback((e) => {
    setPhone(digitsOnly(e.target.value))
  }, [])

  const goRockStar = useCallback(() => {
    const d = digitsOnly(phone)
    if (d.length !== 10 || entering) return
    writeDemoLoginPhone(d)
    setEntering(true)
    if (postRockStarNavTimerRef.current != null) {
      window.clearTimeout(postRockStarNavTimerRef.current)
    }
    postRockStarNavTimerRef.current = window.setTimeout(() => {
      postRockStarNavTimerRef.current = null
      navigate('/screen1')
    }, SCREEN0_POST_ROCKSTAR_HOLD_MS)
  }, [phone, entering, navigate])

  const showFakeSample =
    step === 'login' && phone.length === 0 && !phoneFocused

  return (
    <div className="screen0-root" ref={rootRef}>
      <div className="screen0-bg" aria-hidden="true">
        <div className="screen0-bgDecor" />
        {showVideoLayer ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={marqueeVideoRef}
            key={customSrc}
            src={customSrc}
            muted
            playsInline
            loop
            preload="auto"
            onError={() => setMediaFailed(true)}
            onLoadedData={() => {
              const el = marqueeVideoRef.current
              if (el) void el.play().catch(() => {})
            }}
            style={{
              transform,
              transformOrigin: 'center center',
            }}
          />
        ) : null}
        {showImageLayer ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={customSrc}
            alt=""
            onError={() => setMediaFailed(true)}
            style={{
              transform,
              transformOrigin: 'center center',
            }}
          />
        ) : null}
      </div>

      {entering ? <div className="screen0-enterFlash" aria-hidden /> : null}

      {!entering ? (
      <div className="screen0-bottom">
        <div
          className={`screen0-dock${step === 'login' ? ' screen0-dock--login' : ''}`}
        >
          {step === 'landing' ? (
            <button
              type="button"
              className="screen0-dockWelcome"
              onClick={() => setStep('login')}
            >
              Welcome
            </button>
          ) : (
            <div className="screen0-dockRow">
              <button
                type="button"
                className="screen0-dockIconBack"
                disabled={entering}
                onClick={() => {
                  setStep('landing')
                  setPhone('')
                  setPhoneFocused(false)
                }}
                aria-label="Back"
              >
                ←
              </button>
              <label className="screen0-dockField">
                <span className="screen0-srOnly">Mobile number, 10 digits</span>
                {showFakeSample ? (
                  <span className="screen0-fakeSample" aria-hidden="true">
                    (<span className="screen0-fakeBlink">5</span>55) 000-0000
                  </span>
                ) : null}
                <input
                  id="screen0-phone"
                  className={`screen0-dockInput${showFakeSample ? ' screen0-dockInput--ghost' : ''}`}
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  placeholder=""
                  value={formatPhoneDisplay(phone)}
                  onChange={onPhoneChange}
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => setPhoneFocused(false)}
                  disabled={entering}
                />
              </label>
              {phone.length === 10 ? (
                <button
                  type="button"
                  className="screen0-dockGo"
                  disabled={entering}
                  onClick={goRockStar}
                >
                  Rock Star
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
      ) : null}
    </div>
  )
}

export default Screen0
