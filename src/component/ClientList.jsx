import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';

const ACCENT = '#ff7819';

const CARD_WIDTH = 380;
const CARD_HEIGHT = 56;

const ClientCard = ({ name, time, service, isActive, showTimer, onClick }) => {
  const outerStyle = {
    position: 'relative',
    width: `${CARD_WIDTH}px`,
    height: `${CARD_HEIGHT}px`,
    marginBottom: '6px',
    padding: '1.5px',
    borderRadius: '11.5px',
    background: `linear-gradient(to right, ${ACCENT} 0%, ${ACCENT}cc 18%, ${ACCENT}66 45%, ${ACCENT}00 85%)`,
    cursor: 'pointer',
    boxSizing: 'border-box',
  };

  const innerStyle = {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: '#1A1A1A',
    borderRadius: '10px',
    padding: '8px 72px 8px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    boxSizing: 'border-box',
  };

  const leftStyle = {
    flex: '1 1 0',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  };

  const nameStyle = {
    fontSize: '14px',
    fontWeight: 700,
    color: '#f5f5f7',
    lineHeight: 1.15,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    margin: 0,
  };

  const timeStyle = {
    fontSize: '10px',
    color: 'rgba(245, 245, 247, 0.55)',
    letterSpacing: '0.02em',
    margin: 0,
  };

  const centerStyle = {
    flex: '1 1 0',
    minWidth: 0,
    fontSize: '10.5px',
    color: 'rgba(245, 245, 247, 0.72)',
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    padding: '0 4px',
  };

  const timerBtnBase = {
    flex: '0 0 auto',
    width: '44px',
    height: '44px',
    minWidth: '44px',
    minHeight: '44px',
    border: `1px solid ${ACCENT}`,
    borderRadius: '8px',
    padding: 0,
    fontSize: '10.5px',
    fontWeight: 700,
    color: ACCENT,
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    lineHeight: 1.1,
    letterSpacing: '0.03em',
    boxSizing: 'border-box',
  };

  const timerBtnActive = {
    ...timerBtnBase,
    color: '#0a0a0c',
    background: ACCENT,
    boxShadow: '0 0 12px rgba(255, 120, 25, 0.35)',
  };

  return (
    <div style={outerStyle} onClick={onClick} role="button" tabIndex={0}>
      <div style={innerStyle}>
        <div style={leftStyle}>
          <div style={nameStyle}>{name}</div>
          {time ? <div style={timeStyle}>{time}</div> : null}
        </div>
        <div style={centerStyle}>{service}</div>
        <div style={showTimer ? timerBtnActive : timerBtnBase}>
          {showTimer ? '25' : <>Set<br />Timer</>}
        </div>
      </div>
    </div>
  );
};

const ClientList = () => {
  const wrapperStyle = {
    width: '100%',
    padding: '6px 0 8px',
    boxSizing: 'border-box',
  };

  const { setIsTimer, setSelectedClientData } = useContext(AppContext);

  const handleClientClick = (clientData) => {
    setSelectedClientData(clientData);
  };

  return (
    <div style={wrapperStyle}>
      <ClientCard
        name="Cristi Curls"
        time="8:00 AM – 9:10 AM"
        service="Extension install"
        isActive
        showTimer
        onClick={() => handleClientClick({
          name: 'Cristi Curls',
          service: 'Extension install',
          price: 300,
          color: ACCENT,
          consultationDate: '7.2.2025',
          duration: '30 min',
          notes:
            'Redken shades EQ 7N. 7WB. No left developer.\n Next time use more 7N \n A Kool dude!!! \n Sister in law is pregnant and expecting twins. They just \n started rebuilding the cabin. Jennifer is going to FSU',
          services: [
            { name: 'Hair Gloss Treatment', price: 70 },
            { name: 'Blonding Service', price: 120 },
          ],
          recommendations: [{ name: 'Blonding Service', price: 120 }],
          homeCare: 'Use sulfate-free shampoo and conditioner. Apply hair mask weekly.',
        })}
      />
      <ClientCard
        name="Jon Klein"
        time="9:15 AM – 10:00 AM"
        service="Full lived-in color"
        isActive
        showTimer
        onClick={() => handleClientClick({
          name: 'Jon Klein',
          service: 'Full lived-in color',
          price: 220,
          color: ACCENT,
          consultationDate: '8.15.2025',
          duration: '45 min',
          notes:
            'Redken shades EQ 7N. 7WB. No left developer.\nNext time use more 7N\nA Kool dude!!!\nSister in law is pregnant and expecting twins. They just\n started rebuilding the cabin. Jennifer is going to FSU',
          services: [
            { name: 'Balayage', price: 150 },
            { name: 'Toner Application', price: 60 },
          ],
          recommendations: [{ name: 'Deep Conditioning Treatment', price: 50 }],
          homeCare: [
            { name: 'Rusk: Rusk COLORxConditioner', price: 25, img: './img1.png' },
            { name: 'Rusk: Rusk VHAB Shampoo', price: 30, img: './img2.png' },
          ],
        })}
      />
      <ClientCard
        name="Joe Styles"
        time="10:15 AM – 10:55 AM"
        service="Men’s haircut and color"
        isActive
        showTimer
        onClick={() => handleClientClick({
          name: 'Joe Styles',
          service: 'Men’s haircut and color',
          price: 125,
          color: ACCENT,
          consultationDate: '9.5.2025',
          duration: '40 min',
          notes:
            'Used Redken for men’s color.\nTrimmed sides and blended top.\nClient prefers natural look.',
          services: [
            { name: 'Haircut', price: 60 },
            { name: 'Color Touch-up', price: 65 },
          ],
          recommendations: [{ name: 'Scalp Treatment', price: 40 }],
          homeCare: 'Use moisturizing shampoo. Avoid heavy styling products.',
        })}
      />
      <ClientCard
        name="Nita Haredoo"
        time="11:00 AM – 11:45 AM"
        service="Extensions and color consultation"
        showTimer={false}
        onClick={() => {
          setIsTimer(true);
        }}
      />
      <ClientCard
        name="Sara Bloom"
        time="12:00 PM – 1:00 PM"
        service="Partial highlights"
        isActive
        showTimer
        onClick={() => handleClientClick({
          name: 'Sara Bloom',
          service: 'Partial highlights',
          price: 185,
          color: ACCENT,
          consultationDate: '10.4.2025',
          duration: '60 min',
          notes: 'Wheat-blonde balayage maintenance.\nAvoid going lighter at temples.',
          services: [
            { name: 'Partial Highlights', price: 130 },
            { name: 'Toner', price: 55 },
          ],
          recommendations: [{ name: 'Bond Repair', price: 40 }],
          homeCare: 'Use violet shampoo 1× per week.',
        })}
      />
      <ClientCard
        name="Mark Rivera"
        time="1:15 PM – 1:45 PM"
        service="Beard sculpt + cut"
        isActive
        showTimer
        onClick={() => handleClientClick({
          name: 'Mark Rivera',
          service: 'Beard sculpt + cut',
          price: 55,
          color: ACCENT,
          consultationDate: '10.18.2025',
          duration: '30 min',
          notes: 'Keep #2 fade on sides, scissor crown.\nHot towel + balm.',
          services: [
            { name: "Men's Cut", price: 35 },
            { name: 'Beard Trim', price: 20 },
          ],
          recommendations: [],
          homeCare: 'Beard oil 2× daily.',
        })}
      />
      <ClientCard
        name="Ava Chen"
        time="2:00 PM – 3:15 PM"
        service="Bridal trial"
        showTimer={false}
        onClick={() => handleClientClick({
          name: 'Ava Chen',
          service: 'Bridal trial',
          price: 150,
          color: ACCENT,
          consultationDate: '11.2.2025',
          duration: '75 min',
          notes: 'Soft updo, off-center part. Reference photo on file.',
          services: [{ name: 'Bridal Trial', price: 150 }],
          recommendations: [{ name: 'Day-of Bridal Hair', price: 200 }],
          homeCare: 'Avoid heavy styling night before.',
        })}
      />
    </div>
  );
};

export default ClientList;
