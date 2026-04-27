import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function RebookAndCheckout({ onClick }) {
  const [rebookClicked, setRebookClicked] = useState(false);
  const [checkoutClicked, setCheckoutClicked] = useState(false);

  const navigate = useNavigate()

  const handleRebookClick = (e) => {
    setRebookClicked(true);
    if (onClick) onClick(e);
  };

  const handleCheckoutClick = (e) => {
    setCheckoutClicked(true);
    if (onClick) onClick(e);
    navigate("/climax")
  };

  return (
    <div style={{
      display: 'flex',
      gap: '20px',
      backgroundColor: 'transparent',
      padding: '20px',
      borderRadius: '20px',
      justifyContent: 'center'
    }}>
      <button
        style={{
          background: rebookClicked
            ? 'linear-gradient(to bottom right, #072C3C, #092637)'
            : 'linear-gradient(180deg, #1a1a1f 0%, #000000 100%)',
          border: rebookClicked ? '1px solid #2DB9FF' : 'none',
          color: '#2DB9FF', // Always blue text
          borderRadius: '8px',
          width: '160.5px',
          height: '61px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: '16px',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onClick={handleRebookClick}
      >
        <svg width="18" height="16" viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: '10px' }}>
          <path d="M17.8998 4.35L15.1098 7.14C14.7898 7.46 15.0098 8 15.4598 8H17.2498C17.2498 11.31 14.5598 14 11.2498 14C10.4598 14 9.68979 13.85 8.99979 13.56C8.63979 13.41 8.22979 13.52 7.95979 13.79C7.44979 14.3 7.62979 15.16 8.29979 15.43C9.20979 15.8 10.2098 16 11.2498 16C15.6698 16 19.2498 12.42 19.2498 8H21.0398C21.4898 8 21.7098 7.46 21.3898 7.15L18.5998 4.36C18.4098 4.16 18.0898 4.16 17.8998 4.35ZM5.24979 8C5.24979 4.69 7.93979 2 11.2498 2C12.0398 2 12.8098 2.15 13.4998 2.44C13.8598 2.59 14.2698 2.48 14.5398 2.21C15.0498 1.7 14.8698 0.84 14.1998 0.57C13.2898 0.2 12.2898 0 11.2498 0C6.82979 0 3.24979 3.58 3.24979 8H1.45979C1.00979 8 0.789786 8.54 1.10979 8.85L3.89979 11.64C4.09979 11.84 4.40979 11.84 4.60979 11.64L7.39979 8.85C7.70979 8.54 7.48979 8 7.03979 8H5.24979Z" fill="#25AFFF"/>
        </svg>
        Rebook
      </button>

      <button 
        style={{
          background: checkoutClicked
            ? 'linear-gradient(to bottom, #1D1D1D, rgba(241, 185, 0, 0.61))'
            : 'linear-gradient(180deg, #1a1a1f 0%, #000000 100%)',
          border: checkoutClicked ? '1px solid #F1B700' : 'none',
          color: '#F1B700', // Always gold text
          borderRadius: '8px',
          width: '160.5px',
          height: '61px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: '16px',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onClick={handleCheckoutClick}
      >
        <svg
          width="16"
          height="17"
          viewBox="0 0 16 17"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ marginBottom: '10px' }}
        >
          <path
            d="M10.15 2L9.91 0.8C9.82 0.34 9.41 0 8.93 0H1.75C1.2 0 0.75 0.45 0.75 1V16C0.75 16.55 1.2 17 1.75 17C2.3 17 2.75 16.55 2.75 16V10H8.35L8.59 11.2C8.68 11.67 9.09 12 9.57 12H14.75C15.3 12 15.75 11.55 15.75 11V3C15.75 2.45 15.3 2 14.75 2H10.15Z"
            fill="#FFA704"
          />
        </svg>
        ClimaX
      </button>
    </div>
  );
}

export default RebookAndCheckout;