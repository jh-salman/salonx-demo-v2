import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readMarqueePersisted } from '../../sync/v2AdminBootstrap.js'
import { writeDemoLoginPhone } from '../../lib/demoLoginPhone.js'
import { optimizeMediaDeliveryUrl } from '../../lib/mediaDeliveryUrl.js'
import { syncSalonxShellHeight } from '../../layout/viewportShellSync.js'
import '../style/screen0.css'

function urlLooksLikeVideo(url) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(String(url || ''))
}

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '').slice(0, 10)
}

function formatPhoneDisplay(digits) {
  const d = digitsOnly(digits)
  if (d.length === 0) return ''
  if (d.length <= 3) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

/** After Rock Star: full-bleed hold before route. */
const SCREEN0_POST_ROCKSTAR_HOLD_MS = 3000

function Screen0() {
  const navigate = useNavigate()
  const marqueeVideoRef = useRef(null)
  const postRockStarNavTimerRef = useRef(null)
  const [marquee, setMarquee] = useState(() => readMarqueePersisted())
  const [step, setStep] = useState('landing')
  const [phone, setPhone] = useState('')
  const [glassKeyboardOpen, setGlassKeyboardOpen] = useState(false)
  const [entering, setEntering] = useState(false)
  const [mediaFailed, setMediaFailed] = useState(false)

  const phoneDigits = digitsOnly(phone)
  const phoneComplete = phoneDigits.length === 10

  useEffect(() => {
    const onSync = () => setMarquee(readMarqueePersisted())
    window.addEventListener('salonx:v2admin-marquee', onSync)
    return () => window.removeEventListener('salonx:v2admin-marquee', onSync)
  }, [])

  useEffect(() => {
    if (step !== 'login') return undefined
    syncSalonxShellHeight()
    const id = window.requestAnimationFrame(syncSalonxShellHeight)
    return () => window.cancelAnimationFrame(id)
  }, [step, glassKeyboardOpen])

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
  const transform = `translate(0%, 0%) rotate(${adjust.rotate}deg) scale(${adjust.scale})`

  const showVideoLayer = Boolean(customSrc) && !mediaFailed && isVideo
  const showImageLayer = Boolean(customSrc) && !mediaFailed && !isVideo

  useEffect(() => {
    const el = marqueeVideoRef.current
    if (!el || !isVideo) return
    void el.play().catch(() => {})
  }, [isVideo, deliverySrc])

  useEffect(
    () => () => {
      if (postRockStarNavTimerRef.current != null) {
        window.clearTimeout(postRockStarNavTimerRef.current)
        postRockStarNavTimerRef.current = null
      }
    },
    [],
  )

  const resetToLanding = useCallback(() => {
    setGlassKeyboardOpen(false)
    setPhone('')
    setStep('landing')
  }, [])

  const openLogin = useCallback(() => {
    if (entering) return
    setStep('login')
    setGlassKeyboardOpen(true)
  }, [entering])

  const appendDigit = useCallback((digit) => {
    setPhone((prev) => digitsOnly(`${prev}${digit}`))
  }, [])

  const backspaceDigit = useCallback(() => {
    setPhone((prev) => digitsOnly(prev).slice(0, -1))
  }, [])

  const goRockStar = useCallback(() => {
    if (!phoneComplete || entering) return
    writeDemoLoginPhone(phoneDigits)
    setGlassKeyboardOpen(false)
    setEntering(true)
    if (postRockStarNavTimerRef.current != null) {
      window.clearTimeout(postRockStarNavTimerRef.current)
    }
    postRockStarNavTimerRef.current = window.setTimeout(() => {
      postRockStarNavTimerRef.current = null
      navigate('/screen1')
    }, SCREEN0_POST_ROCKSTAR_HOLD_MS)
  }, [entering, navigate, phoneComplete, phoneDigits])

  const handlePhoneKeyDown = useCallback(
    (e) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        appendDigit(e.key)
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        backspaceDigit()
      }
      if (e.key === 'Enter' && phoneComplete) {
        e.preventDefault()
        goRockStar()
      }
    },
    [appendDigit, backspaceDigit, goRockStar, phoneComplete],
  )

  const dockClass =
    step === 'login'
      ? 'screen0-dock screen0-dock--login'
      : 'screen0-dock'

  const phoneDisplay = formatPhoneDisplay(phoneDigits)
  const sampleTail = '(555) 123-4567'.slice(phoneDisplay.length)

  return (
    <div
      className="screen0-root"
      data-salonx-keyboard-lock={step === 'login' ? '' : undefined}
      onKeyDown={step === 'login' ? handlePhoneKeyDown : undefined}
    >
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

      {!entering && step === 'login' && glassKeyboardOpen ? (
        <button
          type="button"
          className="screen0-kbScrim"
          aria-label="Close keypad"
          onClick={() => setGlassKeyboardOpen(false)}
        />
      ) : null}

      {!entering ? (
        <div className="screen0-bottom">
          <div className="screen0-bottomInner">
            {!entering && step === 'login' && glassKeyboardOpen ? (
              <div
                className="screen0-glassKeypad"
                role="group"
                aria-label="Phone keypad"
                onPointerDown={(e) => e.preventDefault()}
              >
                <div className="screen0-glassKeypad-grid">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      className="screen0-glassKey"
                      onClick={() => appendDigit(digit)}
                    >
                      {digit}
                    </button>
                  ))}
                </div>
                <div className="screen0-glassKeypad-row">
                  <button
                    type="button"
                    className="screen0-glassKey screen0-glassKey--wide"
                    aria-label="Delete"
                    onClick={backspaceDigit}
                  >
                    ⌫
                  </button>
                  <button
                    type="button"
                    className="screen0-glassKey"
                    onClick={() => appendDigit('0')}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    className="screen0-glassKey screen0-glassKey--accent"
                    aria-label="Done"
                    onClick={() => setGlassKeyboardOpen(false)}
                  >
                    ✓
                  </button>
                </div>
              </div>
            ) : null}

            <div className={dockClass}>
              {step === 'landing' ? (
                <button type="button" className="screen0-dockWelcome" onClick={openLogin}>
                  Welcome
                </button>
              ) : (
                <div className="screen0-dockRow">
                  <button
                    type="button"
                    className="screen0-dockIconBack"
                    disabled={entering}
                    onClick={resetToLanding}
                    aria-label="Back"
                  >
                    ←
                  </button>
                  <div
                    className="screen0-dockField"
                    onPointerDown={(e) => {
                      e.preventDefault()
                      setGlassKeyboardOpen(true)
                    }}
                  >
                    {phoneDisplay.length === 0 ? (
                      <span className="screen0-fakeSample" aria-hidden>
                        <span className="screen0-fakeBlink">(</span>
                        {sampleTail}
                      </span>
                    ) : null}
                    <div
                      id="screen0-phone"
                      className={`screen0-dockInput screen0-dockDisplay${phoneDisplay.length === 0 ? ' screen0-dockInput--ghost' : ''}`}
                      role="textbox"
                      aria-readonly="true"
                      aria-label="Phone number"
                      aria-describedby="screen0-phone-hint"
                    >
                      {phoneDisplay}
                    </div>
                    <span id="screen0-phone-hint" className="screen0-srOnly">
                      Enter ten digits, then tap Rock Star
                    </span>
                  </div>
                  <button
                    type="button"
                    className="screen0-dockGo"
                    disabled={!phoneComplete || entering}
                    onPointerDown={(e) => {
                      if (phoneComplete && !entering) e.preventDefault()
                    }}
                    onClick={goRockStar}
                  >
                    Rock Star
                  </button>
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
