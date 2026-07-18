import { useNavigate } from 'react-router-dom'
import { V2_ADMIN_STATION_URL } from './SettingsScreen'
import '../style/settings.css'

/** /settings/admin — SalonX v2 admin embedded in-app (fullscreen iframe). */
export default function SettingsAdmin() {
  const navigate = useNavigate()

  return (
    <div className="settings-root settings-admin-root">
      <div className="settings-top settings-admin__top">
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
        <span className="settings-title">Admin Station</span>
      </div>
      <div className="settings-embedWrap settings-embedWrap--fullscreen">
        <iframe
          title="SalonX Admin"
          className="settings-adminFrame"
          src={V2_ADMIN_STATION_URL}
          allow="fullscreen; clipboard-write"
        />
      </div>
    </div>
  )
}
