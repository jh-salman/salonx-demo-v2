import React from 'react';

import '../style/settings.css';

/** SalonX v2 admin — fullscreen embed on the Settings route (gear). */
export const V2_ADMIN_STATION_URL =
  String(import.meta.env.VITE_V2_ADMIN_STATION_URL || '').trim() ||
  'https://salonx-demo-admin.onrender.com/station';

function SettingsScreen() {
  return (
    <div className="settings-root settings-root--fullscreenEmbed">
      <div className="settings-embedWrap settings-embedWrap--fullscreen">
        <iframe
          title="SalonX Admin"
          className="settings-adminFrame"
          src={V2_ADMIN_STATION_URL}
          allow="fullscreen; clipboard-write"
        />
      </div>
    </div>
  );
}

export default SettingsScreen;
