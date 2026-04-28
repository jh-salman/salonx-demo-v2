import React, { useContext, useRef, useState, useLayoutEffect } from 'react';
import { AppContext } from '../context/AppContext';


function Profile() {
  const buttonRef = useRef(null);
  const [ballOffset, setBallOffset] = useState(0);
  const { setSelectSlider, setIsTimer,ballAtRight, setBallAtRight } = useContext(AppContext);
  


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
      // context updated after slide
      setBallAtRight(isMovingRight);
    }
  };


  return (
    <div style={wrapperStyle}>
      <div style={headerStyle}>
        <img
          src="./profile.png"
          alt="Tiffany Styles"
          style={imageStyle}
        />
        <div
          style={sliderWrapperStyle}
        >
          <div
            ref={buttonRef}
            onClick={handleMuseClick}
            style={sliderContainerStyle}
          >
            <div
              style={sliderTrackStyle}
            >
              <div
                style={{ ...sliderBallStyle, left: `${ballOffset}px` }}
              />
            </div>
            muse
          </div>
        </div>
      </div>
      <div style={nameStyle}>Tiffany Styles</div>
    </div>
  );
}


// Animation for slide-in effect
// Inject style tag for slideIn animation
<style>
  {`
@keyframes slideIn {
  0% { transform: translateX(-100%); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}
`}
</style>

const wrapperStyle = {
  backgroundColor: 'rgba(0, 0, 0, 0.4)',
  backdropFilter: 'blur(5px)',
  WebkitBackdropFilter: 'blur(5px)',
  width: '360px',
  height: '250px',
  borderTopRightRadius: '600px',
  borderBottomRightRadius: '51px',
  padding: '16px',
  textAlign: 'center',
};
const headerStyle = {
  position: 'relative',
  marginBottom: '12px',
};
const imageStyle = {
  width: '230px',
  height: '160px',
  objectFit: 'cover',
  borderRadius: '16px',
  margin: '0 auto',
  zIndex: 10,
};
const sliderWrapperStyle = {
  position: 'absolute',
  bottom: '-30px',
  left: '-16px',
};
const sliderContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '5px 20px',
  borderRadius: '50px',
  backgroundColor: '#0A0A0A',
  border: '2px solid #302EFF',
  boxShadow: 'none',
  cursor: 'pointer',
  color: '#FF6826',
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
  background: 'radial-gradient(circle at center, #FF6826, #FFA500)',
  boxShadow: 'none',
  cursor: 'pointer',
  top: '1px',
  transition: 'left 0.3s ease',
};
const nameStyle = {
  color: '#CFFFFF',
  fontSize: '24px',
  fontWeight: '600',
};

export default Profile;
