import SettingsSubScreen from './SettingsSubScreen'
import SettingsInviteStaff from './SettingsInviteStaff'

/** /settings/staff — invite and manage team members. */
export default function SettingsStaff() {
  return (
    <SettingsSubScreen
      title="Staff"
      subtitle="Invite stylists and manage pending invitations."
    >
      <SettingsInviteStaff pageMode />
    </SettingsSubScreen>
  )
}
