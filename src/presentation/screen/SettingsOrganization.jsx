import SettingsSubScreen from './SettingsSubScreen'
import SettingsOrgPanel from './SettingsOrgPanel'

/** /settings/organization — switch or create the active organization. */
export default function SettingsOrganization() {
  return (
    <SettingsSubScreen
      title="Organization"
      subtitle="Switch between your salons or create a new one."
    >
      <SettingsOrgPanel />
    </SettingsSubScreen>
  )
}
