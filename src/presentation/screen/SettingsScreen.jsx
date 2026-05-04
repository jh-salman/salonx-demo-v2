import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretLeft } from 'phosphor-react';
import { useTheme } from '../../context/ThemeContext';
import {
  DEFAULT_PRIMARY_HEX,
  normalizePrimaryHex,
  SALONX_BRAND_BLUE_HEX,
} from '../../theme/primaryTheme';
import '../style/settings.css';

const PRESETS = [
  { label: 'Blue', hex: SALONX_BRAND_BLUE_HEX },
  { label: 'Orange', hex: '#f97316' },
  { label: 'Pink', hex: '#ec4899' },
];

function SettingsScreen() {
  const navigate = useNavigate();
  const { primaryHex, setPrimaryHex } = useTheme();

  const normalized = useMemo(() => normalizePrimaryHex(primaryHex), [primaryHex]);

  return (
    <div className="settings-root">
      <div className="settings-top">
        <button
          type="button"
          className="settings-back"
          aria-label="Back"
          onClick={() => navigate(-1)}
        >
          <CaretLeft size={24} weight="bold" aria-hidden />
        </button>
        <h1 className="settings-title">Theme</h1>
      </div>

      <p className="settings-sub">
        Primary color updates toolbars, client stage accents, checkout highlights, and
        other brand-tinted UI. Life, path, and alert colors stay separate.
      </p>

      <div className="settings-sectionLabel">Presets</div>
      <div className="settings-swatches">
        {PRESETS.map(({ label, hex }) => {
          const active = normalizePrimaryHex(hex) === normalized;
          return (
            <button
              key={hex}
              type="button"
              className={`settings-swatch${active ? ' is-active' : ''}`}
              style={{ background: hex }}
              title={label}
              aria-label={`${label} ${hex}`}
              aria-pressed={active}
              onClick={() => setPrimaryHex(hex)}
            />
          );
        })}
      </div>

      <div className="settings-sectionLabel">Custom</div>
      <div className="settings-row">
        <span className="settings-pickerLabel">Pick any color</span>
        <input
          className="settings-colorInput"
          type="color"
          value={normalized}
          aria-label="Primary color"
          onChange={(e) => setPrimaryHex(e.target.value)}
        />
      </div>

      <button
        type="button"
        className="settings-reset"
        onClick={() => setPrimaryHex(DEFAULT_PRIMARY_HEX)}
      >
        Reset to default blue
      </button>

      <button type="button" className="settings-home" onClick={() => navigate('/')}>
        Home
      </button>
    </div>
  );
}

export default SettingsScreen;
