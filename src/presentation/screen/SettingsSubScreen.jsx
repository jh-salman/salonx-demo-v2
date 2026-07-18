import { useNavigate } from 'react-router-dom'
import '../style/settings.css'

/** Shared full-screen shell for a single Settings sub-route (chevron target). */
export default function SettingsSubScreen({ title, subtitle, children }) {
  const navigate = useNavigate()

  return (
    <div className="settings-root settings-sub-root">
      <div className="settings-top">
        <button
          type="button"
          className="settings-back"
          aria-label="Back to settings"
          onClick={() => navigate('/settings')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span className="settings-title">{title}</span>
      </div>
      {subtitle ? <p className="settings-sub">{subtitle}</p> : null}
      <div className="settings-main">{children}</div>
    </div>
  )
}
