import SettingsSubScreen from './SettingsSubScreen'
import SettingsOrgHours from './SettingsOrgHours'

/** /settings/hours — booking hours for the active salon. */
export default function SettingsHours() {
  return (
    <SettingsSubScreen
      title="Business hours"
      subtitle="Set the open days and times clients can book online."
    >
      <SettingsOrgHours pageMode />
    </SettingsSubScreen>
  )
}
