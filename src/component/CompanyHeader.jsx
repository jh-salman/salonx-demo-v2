import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { accentCardGradientCss } from '../theme/primaryTheme';

function CompanyHeader() {
  const { primaryHex } = useTheme();
  const wrapperStyle = {
    position: 'relative',
    padding: '1.5px',
    background: accentCardGradientCss(primaryHex),
    borderRadius: '11.5px',
    width: '100%',
    maxWidth: '100%',
    height: '70px',
    boxSizing: 'border-box',
  };

  return (
    <div style={wrapperStyle}>
      <div style={innerStyle}>
        <div
          onClick={() =>
            window.open(
              'https://lv3.com/?gad_source=1&gad_campaignid=21854289107&gbraid=0AAAAABj5NaAqTlQbtNBMozoKOOa-fhfSr&gclid=EAIaIQobChMIv7jAjqLTjgMVN1R_AB3VZgLaEAAYASAAEgKh9fD_BwE',
              '_blank',
              'noopener,noreferrer',
            )
          }
          style={clickDivStyle}
        >
          <img width={190} src="./levellogo.png" alt="" />
        </div>
        <p style={plusTextStyle}>+</p>
        <div>
          <img width={50} src="./logo.png" alt="" />
        </div>
      </div>
    </div>
  );
}

const innerStyle = {
  position: 'relative',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  width: '100%',
  height: '100%',
  background: '#1A1A1A',
  borderRadius: '10px',
  padding: '5px 72px 5px 24px',
  color: 'white',
  fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
  boxSizing: 'border-box',
};

const clickDivStyle = {
  cursor: 'pointer',
};

const plusTextStyle = {
  fontSize: '21px',
  fontWeight: 'bold',
  background: 'linear-gradient(90deg, #ff00cc, #3333ff)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  textAlign: 'center',
};

export default CompanyHeader;
