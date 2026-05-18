import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readMarqueePersisted } from '../../sync/v2AdminBootstrap.js'
import {
  DEMO_FACE_ID_PHONE,
  writeDemoLoginPhone,
} from '../../lib/demoLoginPhone.js'
import { optimizeMediaDeliveryUrl } from '../../lib/mediaDeliveryUrl.js'
import '../style/screen0.css'

function urlLooksLikeVideo(url) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(String(url || ''))
}

/** Fake Face ID “scan” before Rock Star appears (boss demo). */
const SCREEN0_FACE_ID_MS = 3000
/** After Rock Star: full-bleed video hold before route. */
const SCREEN0_POST_ROCKSTAR_HOLD_MS = 3000

function FaceIdIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      width="32"
      height="32"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        d="M20 28c0-6.6 5.4-12 12-12s12 5.4 12 12M44 36c0 6.6-5.4 12-12 12s-12-5.4-12-12"
      />
      <circle cx="26" cy="30" r="2.4" fill="currentColor" />
      <circle cx="38" cy="30" r="2.4" fill="currentColor" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M28 42c2.2 2.8 5.8 2.8 8 0"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="3 5"
        opacity="0.55"
        d="M32 14v6M32 44v6M14 32h6M44 32h6"
      />
    </svg>
  )
}

function Screen0() {
  const navigate = useNavigate()
  const marqueeVideoRef = useRef(null)
  const postRockStarNavTimerRef = useRef(null)
  const faceIdTimerRef = useRef(null)
  const [marquee, setMarquee] = useState(() => readMarqueePersisted())
  const [step, setStep] = useState('landing')
  const [faceIdReady, setFaceIdReady] = useState(false)
  const [entering, setEntering] = useState(false)
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
  const transform = `translate(0%, 0%) rotate(${adjust.rotate}deg) scale(${adjust.scale})`

  const showVideoLayer =
    Boolean(customSrc) && !mediaFailed && isVideo
  const showImageLayer =
    Boolean(customSrc) && !mediaFailed && !isVideo

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
      if (faceIdTimerRef.current != null) {
        window.clearTimeout(faceIdTimerRef.current)
        faceIdTimerRef.current = null
      }
    },
    [],
  )

  const resetToLanding = useCallback(() => {
    if (faceIdTimerRef.current != null) {
      window.clearTimeout(faceIdTimerRef.current)
      faceIdTimerRef.current = null
    }
    setFaceIdReady(false)
    setStep('landing')
  }, [])

  const startFaceId = useCallback(() => {
    if (entering) return
    setFaceIdReady(false)
    setStep('faceId')
    if (faceIdTimerRef.current != null) {
      window.clearTimeout(faceIdTimerRef.current)
    }
    faceIdTimerRef.current = window.setTimeout(() => {
      faceIdTimerRef.current = null
      setFaceIdReady(true)
    }, SCREEN0_FACE_ID_MS)
  }, [entering])

  const goRockStar = useCallback(() => {
    if (!faceIdReady || entering) return
    writeDemoLoginPhone(DEMO_FACE_ID_PHONE)
    setEntering(true)
    if (postRockStarNavTimerRef.current != null) {
      window.clearTimeout(postRockStarNavTimerRef.current)
    }
    postRockStarNavTimerRef.current = window.setTimeout(() => {
      postRockStarNavTimerRef.current = null
      navigate('/screen1')
    }, SCREEN0_POST_ROCKSTAR_HOLD_MS)
  }, [faceIdReady, entering, navigate])

  const dockClass =
    step === 'faceId'
      ? `screen0-dock screen0-dock--faceId${faceIdReady ? ' screen0-dock--faceIdReady' : ''}`
      : 'screen0-dock'

  return (
    <div className="screen0-root">
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

      {!entering ? (
        <div className="screen0-bottom">
          <div className="screen0-bottomInner">
            <div className={dockClass}>
              {step === 'landing' ? (
                <button
                  type="button"
                  className="screen0-dockWelcome"
                  onClick={startFaceId}
                >
                  Welcome
                </button>
              ) : faceIdReady ? (
                <div className="screen0-dockRow screen0-dockRow--rockStar">
                  <button
                    type="button"
                    className="screen0-dockIconBack"
                    disabled={entering}
                    onClick={resetToLanding}
                    aria-label="Back"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="screen0-dockGo screen0-dockGo--full"
                    disabled={entering}
                    onPointerDown={(e) => {
                      if (!entering) e.preventDefault()
                    }}
                    onClick={goRockStar}
                  >
                    Rock Star
                  </button>
                </div>
              ) : (
                <div
                  className="screen0-faceId"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <button
                    type="button"
                    className="screen0-dockIconBack screen0-faceId__back"
                    disabled={entering}
                    onClick={resetToLanding}
                    aria-label="Back"
                  >
                    ←
                  </button>
                  <div className="screen0-faceId__body">
                    <div className="screen0-faceId__stage" aria-hidden>
                      <span className="screen0-faceId__glow" />
                      <span className="screen0-faceId__orbit" />
                      <span className="screen0-faceId__ripple" />
                      <span className="screen0-faceId__ripple screen0-faceId__ripple--2" />
                      <span className="screen0-faceId__ripple screen0-faceId__ripple--3" />
                      <span className="screen0-faceId__bracket screen0-faceId__bracket--tl" />
                      <span className="screen0-faceId__bracket screen0-faceId__bracket--tr" />
                      <span className="screen0-faceId__bracket screen0-faceId__bracket--bl" />
                      <span className="screen0-faceId__bracket screen0-faceId__bracket--br" />
                      <span className="screen0-faceId__ring">
                        <span className="screen0-faceId__scanBeam" />
                        <FaceIdIcon className="screen0-faceId__icon" />
                      </span>
                    </div>
                    <span className="screen0-faceId__label">Face ID</span>
                    <span className="screen0-faceId__status">
                      Scanning
                      <span className="screen0-faceId__dots" aria-hidden>
                        <span>.</span>
                        <span>.</span>
                        <span>.</span>
                      </span>
                    </span>
                  </div>
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
