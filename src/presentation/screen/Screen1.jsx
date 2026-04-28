import React, { useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import { Scissors, User, Lightning, CalendarBlank, X } from 'phosphor-react';
import CurvedLine from '../../component/CurvedLine'
import Profile from '../../component/Profile';
import { AppContext } from '../../context/AppContext';
import CompanyHeader from '../../component/CompanyHeader';
import ClientList from '../../component/ClientList';
import SetTimmer from '../../component/SetTimmer';
import WaitingList from '../../component/WaitingList';
import DynamicDate from '../../component/DynamicDate';
import TopStats from '../../component/TopStats';
import '../style/screen1.css';

const SCREEN1_ACTIVE = 0;
const SCREEN1_TOOLBAR_ITEMS = [
  { Icon: Scissors, label: 'Stylist', to: '/screen1' },
  { Icon: User, label: 'Client details', to: '/screen2' },
  { Icon: Lightning, label: 'Checkout', to: '/checkout' },
  { Icon: CalendarBlank, label: 'Calendar', to: '/calendar' },
  { Icon: X, label: 'Home', to: '/' },
];


function Screen1() {
    const navigate = useNavigate();
    const {
        selectSlider,
        isTimer,
    } = useContext(AppContext);

    return (
        <div className="screen1-container">
            <div className="date-screen1">
                <DynamicDate />
            </div>
            <div id="screen1-modal-root" className="screen1-modal-root" />


            <div className="layout-wrapper">
                <div className="screen1-background">
                    <div className="curvedline-container">
                        <CurvedLine />
                    </div>
                    <div>
                        <div className="profile-panel" style={{transform: selectSlider ? "translateX(-100%)" : "translateX(0)"}}>

                            <Profile />

                        </div>

                        <div className="topstats-panel">

                            <TopStats />

                        </div>
                        <div className='company-header' >
                            <CompanyHeader />
                            

                        </div>
                        <div className="client-list-wrapper client-list" style={{transform: isTimer ? "translateX(-100%)" : "translateX(0%)"}} >
                            <ClientList />

                        </div>
                        <div className="timer-panel" style={{transform: isTimer ? "translateX(0%)" : "translateX(-100%)"}}>

                            <SetTimmer />


                        </div>
                        <div className="waiting-list-wrapper waiting-list">
                            <WaitingList />

                        </div>
                        <div className="screen1-toolbar" role="toolbar" aria-label="Screen toolbar">
                            {SCREEN1_TOOLBAR_ITEMS.map(({ Icon, label, to }, i) => {
                                const isActive = i === SCREEN1_ACTIVE;
                                return (
                                    <button
                                        key={label}
                                        type="button"
                                        className={`screen1-toolbar__btn${isActive ? ' screen1-toolbar__btn--solid' : ''}`}
                                        aria-label={label}
                                        aria-current={isActive ? 'page' : undefined}
                                        onClick={() => navigate(to)}
                                    >
                                        <Icon
                                            size={isActive ? 26 : 24}
                                            weight={isActive ? 'fill' : 'regular'}
                                            aria-hidden
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

            </div>
            <div className="screen1-blackBelow" aria-hidden />
        </div>
    )
}

export default Screen1
