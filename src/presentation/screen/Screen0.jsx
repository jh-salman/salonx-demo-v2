import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readMarqueePersisted } from '../../sync/v2AdminBootstrap.js'
import { writeDemoLoginPhone } from '../../lib/demoLoginPhone.js'
import { optimizeMediaDeliveryUrl } from '../../lib/mediaDeliveryUrl.js'
import { syncSalonxShellHeight } from '../../layout/viewportShellSync.js'
import {
  sendPhoneOtp,
  toE164,
  verifyPhoneOtp,
} from '../../auth/authClient.js'
import { authAppApi } from '../../auth/authAppApi.js'
import { getPendingInvite } from '../../auth/pendingInvite.js'
import '../style/screen0.css'

function urlLooksLikeVideo(url) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(String(url || ''))
}

function digitsOnly(s) {
  // Allow up to 13 digits so BD numbers (01…/880…) fit alongside US 10-digit.
  return String(s || '').replace(/\D/g, '').slice(0, 13)
}

function formatPhoneDisplay(digits) {
  const d = digitsOnly(digits)
  if (d.length === 0) return ''
  // US-style grouping only for a bare 10-digit US number (area code 2–9).
  if (d.length === 10 && d[0] >= '2' && d[0] <= '9') {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  }
  // Otherwise (BD / partial / +country) show grouped raw digits.
  return d.replace(/(\d{3,4})(?=\d)/g, '$1 ').trim()
}

/** After successful sign-in: full-bleed hold before route. */
const SCREEN0_POST_ROCKSTAR_HOLD_MS = 3000

const OTP_LEN = 6
const MOCK_OTP_HINT =
  String(import.meta.env.VITE_AUTH_OTP_MOCK || 'true').toLowerCase() === 'true'
    ? String(import.meta.env.VITE_AUTH_MOCK_OTP_CODE || '123456')
    : ''

function Screen0() {
  const navigate = useNavigate()
  const marqueeVideoRef = useRef(null)
  const postRockStarNavTimerRef = useRef(null)
  const [marquee, setMarquee] = useState(() => readMarqueePersisted())
  /** landing | login | otp */
  const [step, setStep] = useState('landing')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [authError, setAuthError] = useState('')
  const [glassKeyboardOpen, setGlassKeyboardOpen] = useState(false)
  const [entering, setEntering] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mediaFailed, setMediaFailed] = useState(false)
  /** Gate the welcome dock until we know if a session already exists. */
  const [checkingSession, setCheckingSession] = useState(true)

  const phoneDigits = digitsOnly(phone)
  const phoneComplete = Boolean(toE164(phoneDigits))
  const otpDigits = String(otp || '').replace(/\D/g, '').slice(0, OTP_LEN)
  const otpComplete = otpDigits.length === OTP_LEN
  const inAuthDock = step === 'login' || step === 'otp'

  useEffect(() => {
    const onSync = () => setMarquee(readMarqueePersisted())
    window.addEventListener('salonx:v2admin-marquee', onSync)
    return () => window.removeEventListener('salonx:v2admin-marquee', onSync)
  }, [])

  // Already signed in? Skip welcome/login entirely (secure cookie session).
  useEffect(() => {
    let alive = true
    authAppApi
      .me()
      .then((me) => {
        if (!alive) return
        if (me && me.user) {
          const pendingInvite = getPendingInvite()
          if (pendingInvite) {
            navigate(`/invite/${pendingInvite}`, { replace: true })
            return
          }
          navigate(me.members?.length ? '/screen1' : '/onboarding', {
            replace: true,
          })
          return
        }
        setCheckingSession(false)
      })
      .catch(() => {
        if (alive) setCheckingSession(false)
      })
    return () => {
      alive = false
    }
  }, [navigate])

  useEffect(() => {
    if (!inAuthDock) return undefined
    syncSalonxShellHeight()
    const id = window.requestAnimationFrame(syncSalonxShellHeight)
    return () => window.cancelAnimationFrame(id)
  }, [step, glassKeyboardOpen, inAuthDock])

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

  const finishEnter = useCallback(() => {
    setGlassKeyboardOpen(false)
    setEntering(true)
    if (postRockStarNavTimerRef.current != null) {
      window.clearTimeout(postRockStarNavTimerRef.current)
    }
    postRockStarNavTimerRef.current = window.setTimeout(() => {
      postRockStarNavTimerRef.current = null
      navigate('/screen1')
    }, SCREEN0_POST_ROCKSTAR_HOLD_MS)
  }, [navigate])

  const resetToLanding = useCallback(() => {
    setGlassKeyboardOpen(false)
    setPhone('')
    setOtp('')
    setAuthError('')
    setBusy(false)
    setStep('landing')
  }, [])

  const openLogin = useCallback(() => {
    if (entering || busy) return
    setAuthError('')
    setOtp('')
    setStep('login')
    setGlassKeyboardOpen(true)
  }, [entering, busy])

  const appendDigit = useCallback(
    (digit) => {
      if (step === 'otp') {
        setOtp((prev) => String(prev || '').replace(/\D/g, '').slice(0, OTP_LEN) + digit)
        return
      }
      setPhone((prev) => digitsOnly(`${prev}${digit}`))
    },
    [step],
  )

  const backspaceDigit = useCallback(() => {
    if (step === 'otp') {
      setOtp((prev) => String(prev || '').replace(/\D/g, '').slice(0, -1))
      return
    }
    setPhone((prev) => digitsOnly(prev).slice(0, -1))
  }, [step])

  /** Rock Star on phone step → send OTP, keep dock UI, show OTP field. */
  const goRockStarSendOtp = useCallback(async () => {
    if (!phoneComplete || entering || busy) return
    const e164 = toE164(phoneDigits)
    if (!e164) {
      setAuthError('Enter a valid US or Bangladesh phone number')
      return
    }
    setBusy(true)
    setAuthError('')
    writeDemoLoginPhone(phoneDigits)
    try {
      await sendPhoneOtp(e164)
      setOtp('')
      setStep('otp')
      setGlassKeyboardOpen(true)
    } catch (e) {
      const hint =
        e?.status === 404
          ? `Not Found — check demo-api + Vite proxy (${e.url || 'send-otp'})`
          : e?.message || 'Could not send code'
      setAuthError(hint)
    } finally {
      setBusy(false)
    }
  }, [busy, entering, phoneComplete, phoneDigits])

  /** Rock Star on OTP step → verify → session → enter app. */
  const goRockStarVerify = useCallback(async () => {
    if (!otpComplete || entering || busy) return
    const e164 = toE164(phoneDigits)
    if (!e164) {
      setAuthError('Enter a valid US or Bangladesh phone number')
      return
    }
    setBusy(true)
    setAuthError('')
    try {
      await verifyPhoneOtp(e164, otpDigits)
      const pendingInvite = getPendingInvite()
      if (pendingInvite) {
        setGlassKeyboardOpen(false)
        navigate(`/invite/${pendingInvite}`, { replace: true })
        return
      }
      try {
        const me = await authAppApi.me()
        if (!me.members?.length) {
          setGlassKeyboardOpen(false)
          navigate('/onboarding')
          return
        }
      } catch {
        /* still enter demo if me fails */
      }
      finishEnter()
    } catch (e) {
      setAuthError(e?.message || 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }, [
    busy,
    entering,
    finishEnter,
    navigate,
    otpComplete,
    otpDigits,
    phoneDigits,
  ])

  const primaryAction = step === 'otp' ? goRockStarVerify : goRockStarSendOtp
  const primaryEnabled =
    step === 'otp' ? otpComplete && !entering && !busy : phoneComplete && !entering && !busy

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
      if (e.key === 'Enter' && primaryEnabled) {
        e.preventDefault()
        void primaryAction()
      }
    },
    [appendDigit, backspaceDigit, primaryAction, primaryEnabled],
  )

  const dockClass = inAuthDock
    ? 'screen0-dock screen0-dock--login'
    : 'screen0-dock'

  const phoneDisplay = formatPhoneDisplay(phoneDigits)
  const sampleTail = '(212) 555-1234'.slice(phoneDisplay.length)
  const otpDisplay = otpDigits
  const otpSample = '••••••'.slice(otpDisplay.length)

  return (
    <div
      className="screen0-root"
      data-salonx-keyboard-lock={inAuthDock ? '' : undefined}
      onKeyDown={inAuthDock ? handlePhoneKeyDown : undefined}
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

      {!entering && inAuthDock && glassKeyboardOpen ? (
        <button
          type="button"
          className="screen0-kbScrim"
          aria-label="Close keypad"
          onClick={() => setGlassKeyboardOpen(false)}
        />
      ) : null}

      {!entering && !checkingSession ? (
        <div className="screen0-bottom">
          <div className="screen0-bottomInner">
            {!entering && inAuthDock && glassKeyboardOpen ? (
              <div
                className="screen0-glassKeypad"
                role="group"
                aria-label={step === 'otp' ? 'OTP keypad' : 'Phone keypad'}
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

            {authError ? (
              <p className="screen0-authError" role="alert">
                {authError}
              </p>
            ) : null}
            {step === 'otp' && MOCK_OTP_HINT ? (
              <p className="screen0-authHint">Dev code: {MOCK_OTP_HINT}</p>
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
                    disabled={entering || busy}
                    onClick={() => {
                      if (step === 'otp') {
                        setOtp('')
                        setAuthError('')
                        setStep('login')
                        setGlassKeyboardOpen(true)
                        return
                      }
                      resetToLanding()
                    }}
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
                    {step === 'otp' ? (
                      <>
                        {otpDisplay.length === 0 ? (
                          <span className="screen0-fakeSample" aria-hidden>
                            <span className="screen0-fakeBlink">{otpSample.slice(0, 1)}</span>
                            {otpSample.slice(1)}
                          </span>
                        ) : null}
                        <div
                          id="screen0-otp"
                          className={`screen0-dockInput screen0-dockDisplay${otpDisplay.length === 0 ? ' screen0-dockInput--ghost' : ''}`}
                          role="textbox"
                          aria-readonly="true"
                          aria-label="One-time code"
                          aria-describedby="screen0-otp-hint"
                        >
                          {otpDisplay}
                        </div>
                        <span id="screen0-otp-hint" className="screen0-srOnly">
                          Enter six-digit code, then tap Rock Star
                        </span>
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    className="screen0-dockGo"
                    disabled={!primaryEnabled}
                    onPointerDown={(e) => {
                      if (primaryEnabled) e.preventDefault()
                    }}
                    onClick={() => void primaryAction()}
                  >
                    {busy ? '…' : 'Rock Star'}
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
