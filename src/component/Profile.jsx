import React, { useContext, useRef, useState, useLayoutEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { SALONX_BRAND_BLUE_HEX } from '../theme/primaryTheme';

const wrapperStyle = {
  position: 'relative',
  width: '360px',
  height: '250px',
  borderTopRightRadius: '600px',
  borderBottomRightRadius: '51px',
  padding: '16px',
  textAlign: 'center',
  overflow: 'hidden',
  isolation: 'isolate',
};

/** Blur only this layer; photo + controls sit above so they stay sharp. */
const backdropLayerStyle = {
  position: 'absolute',
  inset: 0,
  zIndex: 0,
  borderTopRightRadius: '600px',
  borderBottomRightRadius: '51px',
  backgroundColor: 'rgba(0, 0, 0, 0.4)',
  backdropFilter: 'blur(5px)',
  WebkitBackdropFilter: 'blur(5px)',
  pointerEvents: 'none',
};

const contentLayerStyle = {
  position: 'relative',
  zIndex: 1,
};

const headerStyle = {
  position: 'relative',
  marginBottom: '12px',
  zIndex: 1,
};

const imageStyle = {
  position: 'relative',
  zIndex: 2,
  display: 'block',
  width: '230px',
  height: '160px',
  objectFit: 'cover',
  borderRadius: '16px',
  margin: '0 auto',
};

const sliderWrapperStyle = {
  position: 'absolute',
  bottom: '-30px',
  left: '-16px',
  zIndex: 3,
};

const sliderContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '5px 20px',
  borderRadius: '50px',
  backgroundColor: '#0A0A0A',
  border: `2px solid var(--salonx-primary, ${SALONX_BRAND_BLUE_HEX})`,
  boxShadow: 'none',
  cursor: 'pointer',
  color: `var(--salonx-primary, ${SALONX_BRAND_BLUE_HEX})`,
  fontSize: '10px',
  fontWeight: '900',
  fontFamily: 'sans-serif',
  userSelect: 'none',
  position: 'relative',
};

const sliderTrackStyle = {
  position: 'absolute',
  width: '100%',
  height: '20px',
  top: 0,
  left: 0,
  zIndex: 1,
};

const sliderBallStyle = {
  position: 'absolute',
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  background:
    'radial-gradient(circle at 35% 35%, rgb(var(--salonx-primary-soft-rgb)), rgb(var(--salonx-primary-dark-rgb)))',
  boxShadow: 'none',
  cursor: 'pointer',
  top: '1px',
  transition: 'left 0.3s ease',
};

const nameStyle = {
  position: 'relative',
  zIndex: 1,
  color: '#CFFFFF',
  fontSize: '24px',
  fontWeight: '600',
};

function Profile() {
  const buttonRef = useRef(null);
  const [ballOffset, setBallOffset] = useState(0);
  const { setSelectSlider, setIsTimer, ballAtRight, setBallAtRight } = useContext(AppContext);

  useLayoutEffect(() => {
    if (buttonRef.current) {
      const buttonWidth = buttonRef.current.offsetWidth - 20;
      setBallOffset(ballAtRight ? buttonWidth : 0);
    }
  }, [ballAtRight]);

  const handleMuseClick = () => {
    if (buttonRef.current) {
      const buttonWidth = buttonRef.current.offsetWidth - 20;
      const isMovingRight = !ballAtRight;

      setBallOffset(isMovingRight ? buttonWidth : 0);
      setTimeout(() => {
        setSelectSlider(isMovingRight);
        if (!isMovingRight) {
          setIsTimer(false);
        }
      }, 300);
      setBallAtRight(isMovingRight);
    }
  };

  return (
    <div style={wrapperStyle}>
      <div style={backdropLayerStyle} aria-hidden />
      <div style={contentLayerStyle}>
        <div style={headerStyle}>
          <img src="./profile.png" alt="Tiffany Styles" style={imageStyle} />
          <div style={sliderWrapperStyle}>
            <div ref={buttonRef} onClick={handleMuseClick} style={sliderContainerStyle}>
              <div style={sliderTrackStyle}>
                <div style={{ ...sliderBallStyle, left: `${ballOffset}px` }} />
              </div>
              muse
            </div>
          </div>
        </div>
        <div style={nameStyle}>Tiffany Styles</div>
      </div>
    </div>
  );
}

export default Profile;
