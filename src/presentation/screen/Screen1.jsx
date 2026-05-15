// import React, { useContext, useEffect, useMemo, useState } from 'react'
// import { useNavigate } from 'react-router-dom';
// import { Scissors, User, Lightning, CalendarBlank, Gear, CaretRight } from 'phosphor-react';
// import CurvedLine from '../../component/CurvedLine'
// import Profile from '../../component/Profile';
// import { AppContext } from '../../context/AppContext';
// import CompanyHeader from '../../component/CompanyHeader';
// import ClientList from '../../component/ClientList';
// import SetTimmer from '../../component/SetTimmer';
// import WaitingList from '../../component/WaitingList';
// import DynamicDate from '../../component/DynamicDate';
// import TopStats from '../../component/TopStats';
// import {
//   buildAptNavPayload,
//   readPersistedScreen2Apt,
// } from '../../data/appointmentStateStore';
// import {
//   isSameLocalDay,
//   useCalendarEvents,
// } from '../../data/calendarEventsStore';
// import { optimizeMediaDeliveryUrl } from '../../lib/mediaDeliveryUrl.js';
// import { readS1DemoCurveStripFromSession } from '../../lib/s1DemoCurveStripSession.js';
// import '../style/screen1.css';

// const SCREEN1_ACTIVE = 0;
// const SCREEN1_TOOLBAR_ITEMS = [
//   { Icon: Scissors, label: 'Stylist', to: '/screen1' },
//   // Profile icon → Clients picker (selects a client → Screen2 details).
//   { Icon: User, label: 'Clients', to: '/clients' },
//   { Icon: Lightning, label: 'Checkout', to: '/climax' },
//   { Icon: CalendarBlank, label: 'Calendar', to: '/calendar' },
//   { Icon: Gear, label: 'Settings', to: '/settings' },
// ];


// function Screen1() {
//     const navigate = useNavigate();
//     const calendarEvents = useCalendarEvents();
//     const {
//         selectSlider,
//         setSelectSlider,
//         setBallAtRight,
//         setIsTimer,
//         isTimer,
//     } = useContext(AppContext);

//     const showProfileAgain = () => {
//         setSelectSlider(false);
//         setBallAtRight(false);
//         setIsTimer(false);
//     };

//     // Resolve the appointment the bottom-toolbar buttons should hand off to
//     // Client Details / Checkout / Calendar:
//     //   1. session-restored (last apt the user opened)
//     //   2. earliest of today's appointments
//     // Anything still null just navigates without context (legacy behavior).
//     const toolbarApt = useMemo(() => {
//       const session = readPersistedScreen2Apt();
//       if (session) return session;
//       const today = new Date();
//       const todays = calendarEvents
//         .filter((ev) => isSameLocalDay(ev.start, today))
//         .sort((a, b) => a.start.getTime() - b.start.getTime());
//       return todays.length ? buildAptNavPayload(todays[0]) : null;
//     }, [calendarEvents]);

//     const [curveStrip, setCurveStrip] = useState(() =>
//       readS1DemoCurveStripFromSession(),
//     );
//     useEffect(() => {
//       const onV2Admin = () => setCurveStrip(readS1DemoCurveStripFromSession());
//       window.addEventListener('salonx:v2admin-s1demo', onV2Admin);
//       return () =>
//         window.removeEventListener('salonx:v2admin-s1demo', onV2Admin);
//     }, []);

//     const curveMediaTransform = useMemo(() => {
//       if (!curveStrip) return undefined;
//       const { tx, ty, rotate, scale } = curveStrip.adjust;
//       return `translate(${tx}%, ${ty}%) rotate(${rotate}deg) scale(${scale})`;
//     }, [curveStrip]);

//     return (
//         <div className="screen1-frame">
//         <div className="screen1-container">
//             <div className="date-screen1">
//                 <DynamicDate />
//             </div>
//             <div id="screen1-modal-root" className="screen1-modal-root" />


//             <div className="layout-wrapper">
//                 <div className="screen1-background">
//                     {selectSlider ? (
//                         <button
//                             type="button"
//                             className="screen1-profilePeek"
//                             onClick={showProfileAgain}
//                             aria-label="Show profile and muse slider"
//                         >
//                             <CaretRight size={22} weight="bold" aria-hidden />
//                         </button>
//                     ) : null}
//                     <div>
//                         <div className="profile-panel" style={{transform: selectSlider ? "translateX(-100%)" : "translateX(0)"}}>

//                             <Profile />

//                         </div>

//                         <div className="topstats-panel">

//                             <TopStats />

//                         </div>
//                         <div className='company-header' >
//                             <CompanyHeader />
                            

//                         </div>
//                         <div className="client-list-wrapper client-list" style={{transform: isTimer ? "translateX(-100%)" : "translateX(0%)"}} >
//                             <ClientList />
//                             <WaitingList />
//                         </div>
//                         <div className="timer-panel" style={{transform: isTimer ? "translateX(0%)" : "translateX(-100%)"}}>

//                             <SetTimmer />


//                         </div>
//                         <div className="screen1-toolbar" role="toolbar" aria-label="Screen toolbar">
//                             {SCREEN1_TOOLBAR_ITEMS.map(({ Icon, label, to }, i) => {
//                                 const isActive = i === SCREEN1_ACTIVE;
//                                 return (
//                                     <button
//                                         key={label}
//                                         type="button"
//                                         className={`screen1-toolbar__btn${isActive ? ' screen1-toolbar__btn--solid' : ''}`}
//                                         aria-label={label}
//                                         aria-current={isActive ? 'page' : undefined}
//                                         onClick={() => {
//                                             if (to === '/clients') {
//                                                 navigate(to, { state: { from: '/screen1' } });
//                                                 return;
//                                             }
//                                             navigate(
//                                                 to,
//                                                 toolbarApt && (to === '/screen2' || to === '/climax')
//                                                     ? {
//                                                           state: {
//                                                               apt: toolbarApt,
//                                                               ...(to === '/climax'
//                                                                   ? { from: '/screen1' }
//                                                                   : {}),
//                                                           },
//                                                       }
//                                                     : undefined,
//                                             );
//                                         }}
//                                     >
//                                         <Icon
//                                             size={isActive ? 26 : 24}
//                                             weight={isActive ? 'fill' : 'regular'}
//                                             aria-hidden
//                                         />
//                                     </button>
//                                 );
//                             })}
//                         </div>
//                     </div>
//                     <div
//                         className={`curvedline-container curvedline-container--clientCurve${
//                             curveStrip ? ' curvedline-container--clientCurveHasMedia' : ''
//                         }`}
//                     >
//                         <div className="s1demo-curveStripLayer">
//                             {curveStrip ? (
//                                 <div
//                                     className="s1demo-slot s1demo-curveStripSlot s1demo-slot--committed s1demo-curveStripSlot--clientReadonly"
//                                     aria-hidden
//                                 >
//                                     <div className="s1demo-slot__imgLayer">
//                                         {curveStrip.isVideo ? (
//                                             <video
//                                                 src={optimizeMediaDeliveryUrl(
//                                                     curveStrip.src,
//                                                     'video',
//                                                 )}
//                                                 muted
//                                                 playsInline
//                                                 loop
//                                                 autoPlay
//                                                 draggable={false}
//                                                 style={{
//                                                     objectFit: curveStrip.adjust.fit,
//                                                     transform: curveMediaTransform,
//                                                 }}
//                                             />
//                                         ) : (
//                                             <img
//                                                 src={optimizeMediaDeliveryUrl(
//                                                     curveStrip.src,
//                                                     'image',
//                                                 )}
//                                                 alt=""
//                                                 draggable={false}
//                                                 style={{
//                                                     objectFit: curveStrip.adjust.fit,
//                                                     transform: curveMediaTransform,
//                                                 }}
//                                             />
//                                         )}
//                                     </div>
//                                 </div>
//                             ) : null}
//                         </div>
//                         <CurvedLine hideBodyFill={Boolean(curveStrip)} />
//                         <a
//                             href="https://dangerjonescreative.com/"
//                             className="screen1-cobraCreditLink"
//                             target="_blank"
//                             rel="noopener noreferrer"
//                             aria-label="Danger Jones Creative (opens in new tab)"
//                         />
//                     </div>
//                 </div>

//             </div>
//             <div className="screen1-blackBelow" aria-hidden />
//         </div>
//         </div>
//     )
// }

// export default Screen1
