/** @returns {boolean} */
export function isIosDevice() {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function applyIosStandalonePwaClass() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  if (isIosDevice()) {
    document.documentElement.classList.add('salonx-ios')
  }
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (typeof navigator.standalone === 'boolean' && navigator.standalone === true)
  if (isIosDevice() && isStandalone) {
    document.documentElement.classList.add('salonx-ios-pwa')
  }
}

/** Lock shell to the visible viewport — fixes intermittent bottom gap on iOS Safari / Add to Home. */
export function syncSalonxShellHeight() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const vv = window.visualViewport
  const h = Math.round(vv?.height ?? window.innerHeight)
  if (h > 0) {
    document.documentElement.style.setProperty('--salonx-shell-height', `${h}px`)
  }
}

function scheduleShellHeightRetries() {
  syncSalonxShellHeight()
  requestAnimationFrame(syncSalonxShellHeight)
  return [
    window.setTimeout(syncSalonxShellHeight, 50),
    window.setTimeout(syncSalonxShellHeight, 250),
    window.setTimeout(syncSalonxShellHeight, 800),
  ]
}

/** @returns {() => void} */
export function startSalonxViewportShellSync() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}
  if (!isIosDevice()) return () => {}

  const delayed = scheduleShellHeightRetries()

  const onViewportChange = () => {
    syncSalonxShellHeight()
    requestAnimationFrame(syncSalonxShellHeight)
  }

  window.addEventListener('resize', onViewportChange)
  window.addEventListener('orientationchange', onViewportChange)
  window.addEventListener('pageshow', onViewportChange)
  window.addEventListener('focus', onViewportChange)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') onViewportChange()
  })
  window.visualViewport?.addEventListener('resize', syncSalonxShellHeight)
  window.visualViewport?.addEventListener('scroll', syncSalonxShellHeight)

  return () => {
    delayed.forEach((id) => window.clearTimeout(id))
    window.removeEventListener('resize', onViewportChange)
    window.removeEventListener('orientationchange', onViewportChange)
    window.removeEventListener('pageshow', onViewportChange)
    window.removeEventListener('focus', onViewportChange)
    window.visualViewport?.removeEventListener('resize', syncSalonxShellHeight)
    window.visualViewport?.removeEventListener('scroll', syncSalonxShellHeight)
  }
}
