import React from 'react'
import { useNavigate } from 'react-router-dom';
import { Scissors, User, Lightning, CalendarBlank, X } from 'phosphor-react';

const CHECKOUT_ACTIVE = 2;
const CHECKOUT_TOOLBAR_ITEMS = [
    { Icon: Scissors, label: 'Stylist', to: '/screen1' },
    // Profile icon → Clients picker.
    { Icon: User, label: 'Clients', to: '/clients' },
    { Icon: Lightning, label: 'Checkout', to: '/checkout' },
    { Icon: CalendarBlank, label: 'Calendar', to: '/calendar' },
    { Icon: X, label: 'Home', to: '/' },
];

const toolbarStyle = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: '0 14px',
    background: '#0e0e10',
    borderTop: '1px solid #2b2b2b',
    zIndex: 60,
    boxSizing: 'border-box',
};
const toolbarBtnBase = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#ff7819',
    padding: '6px 9px',
    transition: 'opacity 120ms',
    lineHeight: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent',
};

function CheckOut() {
    const navigate = useNavigate();
    return (
        <div style={{
            height: "100%",
            width: "393px",
            backgroundImage: "url('./gradientbg.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            position: 'relative',
        }}>
            <div style={{ padding: "5px", width: "100%", position: "relative" }}>

                <div
                    style={{
                        width: "350px",
                        zIndex: "10",
                        borderRadius: "22px",
                        background: "rgba(255, 255, 255, 0)",
                        backdropFilter: "blur(19px)",
                        WebkitBackdropFilter: "blur(20px)",
                        color: "white",
                        fontFamily: "sans-serif",
                        position: "absolute",
                        left: "50%",
                        transform: "translateX(-50%)",
                        bottom: "200px",
                        boxShadow: "-6px 8px 400px 27px rgba(0,0,0,0.75)",
                        webkitBoxShadow: "-6px 8px 400px 27px rgba(0,0,0,0.75)",
                        mozBoxShadow:" -6px 8px 400px 27px rgba(0,0,0,0.75)",
                        padding: "20px"
                    }}
                >
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600", opacity: 0.85, textShadow: "1px 1px 2px rgba(0,0,0,0.5)" }}>Client Service</h3>
                        </div>

                        <div style={{ marginTop: "8px", marginBottom: "16px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <p style={{ margin: 0, fontSize: "13px", opacity: 0.8, textShadow: "1px 1px 2px rgba(0,0,0,0.5)" }}>Haircut</p>
                                <p style={{ margin: 0, fontSize: "13px", opacity: 0.8, textShadow: "1px 1px 2px rgba(0,0,0,0.5)" }}>$45</p>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <p style={{ margin: 0, fontSize: "13px", opacity: 0.8, textShadow: "1px 1px 2px rgba(0,0,0,0.5)" }}>Beard Trim</p>
                                <p style={{ margin: 0, fontSize: "13px", opacity: 0.8, textShadow: "1px 1px 2px rgba(0,0,0,0.5)" }}>$20</p>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <p style={{ margin: 0, fontSize: "13px", opacity: 0.8, textShadow: "1px 1px 2px rgba(0,0,0,0.5)" }}>L3VEL3 Wax</p>
                                <p style={{ margin: 0, fontSize: "13px", opacity: 0.8, textShadow: "1px 1px 2px rgba(0,0,0,0.5)" }}>$25</p>
                            </div>
                        </div>

                        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.2)", marginBottom: "16px" }} />

                        <div>
                            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", opacity: 0.85, textShadow: "1px 1px 2px rgba(0,0,0,0.5)" }}>Next Appointment</h3>
                            <p style={{ margin: "4px 0", fontSize: "13px", opacity: 0.8, textShadow: "1px 1px 2px rgba(0,0,0,0.5)" }}>Sept 11, 2025   <span style={{paddingLeft:"7px"}}> 2:30 PM</span>    </p>
                        </div>

                        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.2)", margin: "16px 0" }} />

                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "18px" }}>
                            <span style={{textShadow: "1px 1px 2px rgba(0,0,0,0.5)"}}>Total</span>
                            <span style={{textShadow: "1px 1px 2px rgba(0,0,0,0.5)"}}>$90.00</span>
                        </div>

                        <p style={{ marginTop: "12px", fontSize: "13px", fontWeight: "500", opacity: 0.8, textShadow: "1px 1px 2px rgba(0,0,0,0.5)" }}>* You gained 140 tokens</p>
                    </div>
                </div>


                {/* <h2 style={{ position:"absolute",zIndex:"0",top:"400px",textAlign: "center", marginBottom: "20px", color: "white" }}>CHECKOUT</h2> */}
                <div style={{ position: "absolute", zIndex: "1", top: "80px", left: "50%", transform: "translateX(-50%)", textAlign: "center", marginBottom: "20px", color: "white" }}>
                    <img width={350} src='./girl.png' />
                </div>
                <div
                    style={{
                        width: "100%",
                        height: "840px",

                        borderRadius: "22px",
                        background: "rgba(255, 255, 255, 0.05)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                         boxShadow: "-6px 8px 400px 27px rgba(0,0,0,0.75)",
                        webkitBoxShadow: "-6px 8px 400px 27px rgba(0,0,0,0.75)",
                        mozBoxShadow:" -6px 8px 400px 27px rgba(0,0,0,0.75)",
                        color: "white",
                        fontFamily: "sans-serif",
                        position: "",

                    }}
                >



                </div>
            </div>
            <div style={toolbarStyle} role="toolbar" aria-label="Screen toolbar">
                {CHECKOUT_TOOLBAR_ITEMS.map(({ Icon, label, to }, i) => {
                    const isActive = i === CHECKOUT_ACTIVE;
                    return (
                        <button
                            key={label}
                            type="button"
                            aria-label={label}
                            aria-current={isActive ? 'page' : undefined}
                            onClick={() => navigate(to)}
                            style={{
                                ...toolbarBtnBase,
                                opacity: isActive ? 1 : 0.48,
                                filter: isActive ? 'drop-shadow(0 0 10px rgba(255, 120, 25, 0.35))' : 'none',
                            }}
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
        </div >
    )
}

export default CheckOut