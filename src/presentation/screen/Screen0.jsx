import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readMarqueePersisted } from '../../sync/v2AdminBootstrap.js'
import { writeDemoLoginPhone } from '../../lib/demoLoginPhone.js'
import { optimizeMediaDeliveryUrl } from '../../lib/mediaDeliveryUrl.js'
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
  const phoneInputRef = useRef(null)
  const postRockStarNavTimerRef = useRef(null)
  const [marquee, setMarquee] = useState(() => readMarqueePersisted())
  const [step, setStep] = useState('landing')
  const [phone, setPhone] = useState('')
  const [phoneFocused, setPhoneFocused] = useState(false)
  const [glassKeyboardOpen, setGlassKeyboardOpen] = useState(false)
  const [entering, setEntering] = useState(false)
  /** Hero URL 404 / decode error / video fail — show gradient fallback only. */
  const [mediaFailed, setMediaFailed] = useState(false)

  useEffect(() => {
    const onSync = () => setMarquee(readMarqueePersisted())
    window.addEventListener('salonx:v2admin-marquee', onSync)
    return () => window.removeEventListener('salonx:v2admin-marquee', onSync)
  }, [])

  const customSrc = marquee?.image?.trim() ?? ''
  const isVideo =
    Boolean(customSrc) &&
    (marquee?.mediaKind === 'video' || urlLooksLikeVideo(customSrc))
  const deliverySrc = customSrc
    ? optimizeMediaDeliveryUrl(customSrc, isVideo ? 'video' : 'image')
    : ''

  useEffect(() => {
    setMediaFailed(false)
  }, [customSrc])

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
  }, [isVideo, deliverySrc])

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

  const appendPhoneDigit = useCallback((d) => {
    setPhone((prev) => digitsOnly(`${prev}${d}`).slice(0, 10))
  }, [])

  const phoneBackspace = useCallback(() => {
    setPhone((prev) => prev.slice(0, -1))
  }, [])

  const closeGlassKeyboard = useCallback(() => {
    setGlassKeyboardOpen(false)
    setPhoneFocused(false)
    phoneInputRef.current?.blur()
  }, [])

  const goRockStar = useCallback(() => {
    const d = digitsOnly(phone)
    if (d.length !== 10 || entering) return
    setGlassKeyboardOpen(false)
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

  const handlePhoneKeyDown = useCallback(
    (e) => {
      if (entering) return
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        appendPhoneDigit(e.key)
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        phoneBackspace()
      }
    },
    [appendPhoneDigit, entering, phoneBackspace],
  )

  const handlePhoneBlur = useCallback(() => {
    window.setTimeout(() => {
      const ae = document.activeElement
      if (ae && typeof ae === 'object' && 'id' in ae && ae.id === 'screen0-phone') return
      setPhoneFocused(false)
      setGlassKeyboardOpen(false)
    }, 120)
  }, [])

  return (
    <div className="screen0-root" ref={rootRef}>
      <div className="screen0-bg" aria-hidden="true">
        <div className="screen0-bgDecor" />
        {showVideoLayer ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={marqueeVideoRef}
            key={deliverySrc}
            src={deliverySrc}
            muted
            playsInline
            loop
            preload="metadata"
            onError={() => setMediaFailed(true)}
            onCanPlay={() => {
              const el = marqueeVideoRef.current
              if (el) void el.play().catch(() => {})
            }}
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
            src={deliverySrc}
            alt=""
            fetchPriority="high"
            decoding="async"
            onError={() => setMediaFailed(true)}
            style={{
              transform,
              transformOrigin: 'center center',
            }}
          />
        ) : null}
      </div>

      {entering ? <div className="screen0-enterFlash" aria-hidden /> : null}

      {!entering && glassKeyboardOpen && step === 'login' ? (
        <button
          type="button"
          className="screen0-kbScrim"
          aria-label="Dismiss number pad"
          tabIndex={-1}
          onClick={closeGlassKeyboard}
        />
      ) : null}

      {!entering ? (
      <div className="screen0-bottom">
        <div className="screen0-bottomInner">
        {glassKeyboardOpen && step === 'login' ? (
          <div
            className="screen0-glassKeypad"
            role="group"
            aria-label="Number pad"
            onPointerDown={(e) => e.preventDefault()}
          >
            <div className="screen0-glassKeypad-grid">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  type="button"
                  className="screen0-glassKey"
                  aria-label={d}
                  disabled={entering}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => appendPhoneDigit(d)}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="screen0-glassKeypad-row">
              <button
                type="button"
                className="screen0-glassKey screen0-glassKey--wide"
                aria-label="Delete digit"
                disabled={entering || phone.length === 0}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => phoneBackspace()}
              >
                ⌫
              </button>
              <button
                type="button"
                className="screen0-glassKey"
                aria-label="0"
                disabled={entering}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => appendPhoneDigit('0')}
              >
                0
              </button>
              <button
                type="button"
                className="screen0-glassKey screen0-glassKey--accent"
                aria-label="Done"
                disabled={entering}
                onPointerDown={(e) => e.preventDefault()}
                onClick={closeGlassKeyboard}
              >
                ✓
              </button>
            </div>
          </div>
        ) : null}
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
                  setGlassKeyboardOpen(false)
                  phoneInputRef.current?.blur()
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
                  ref={phoneInputRef}
                  id="screen0-phone"
                  className={`screen0-dockInput${showFakeSample ? ' screen0-dockInput--ghost' : ''}`}
                  name="phone"
                  type="text"
                  inputMode="none"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  readOnly
                  placeholder=""
                  value={formatPhoneDisplay(phone)}
                  onFocus={() => {
                    setPhoneFocused(true)
                    setGlassKeyboardOpen(true)
                  }}
                  onBlur={handlePhoneBlur}
                  onKeyDown={handlePhoneKeyDown}
                  disabled={entering}
                />
              </label>
              {phone.length === 10 ? (
                <button
                  type="button"
                  className="screen0-dockGo"
                  disabled={entering}
                  onPointerDown={(e) => {
                    if (!entering && phone.length === 10) e.preventDefault()
                  }}
                  onClick={goRockStar}
                >
                  Rock Star
                </button>
              ) : null}
            </div>
          )}
        </div>
        </div>
      </div>
      ) : null}
    </div>
  )
}

export default Screen0
