import { useEffect } from 'react'
import './microsite.css'
import {
  ensureMicrositeFonts,
  micrositeThemeStyle,
  normalizeMicrositeTheme,
} from './micrositeTheme'

/**
 * @param {{ salon?: object, children: import('react').ReactNode, landing?: boolean, admin?: boolean }} props
 */
export default function MicrositeShell({
  salon,
  children,
  landing = false,
  admin = false,
}) {
  const theme = normalizeMicrositeTheme(salon?.theme)

  useEffect(() => {
    ensureMicrositeFonts(theme)
  }, [theme.fontHeading, theme.fontBody])

  const className = [
    'ms-shell',
    landing ? 'ms-shell--landing' : '',
    admin ? 'ms-shell--admin' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={className}
      style={micrositeThemeStyle(salon)}
      data-template={salon?.templateId || 'sx-book-v1'}
    >
      <div className={landing ? 'ms-shell__landing' : 'ms-shell__inner'}>
        {children}
      </div>
    </div>
  )
}
