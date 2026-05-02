
import { Link } from 'react-router-dom'

function Screen0() {
    return (
        <div
            style={{
                height: '100%',
                width: '100%',
                backgroundColor: 'black',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                fontFamily: 'sans-serif',
                // borderRadius: '20px',
                // border: '4px solid',
                // borderImage: 'linear-gradient(to right, magenta, cyan) 1',
                // boxSizing: 'border-box',
                // overflow: 'hidden',
                // position: 'relative'
            }}
        >
            {/* <CurvedLine /> */}
            <img
                src="/welcome-img.png"
                alt="L3VEL3 Pro Team"
                style={{
                    position: 'absolute',
                    top: "50%",
                    left: "50%",
                    transform: "Translate(-50%, -50%)",
                    width: '100%',
                    height: '50%',
                    objectFit: 'cover',
                    opacity: 1,
                    zIndex: 0
                }}
            />
            <div style={{ position: 'absolute', zIndex: 1, top: "71%" }}>

                <Link to={"screen1"}>
                    <button
                        style={{
                            padding: '1rem 5.5rem',
                            fontSize: '0.6rem',
                            background: 'linear-gradient(to bottom, rgba(255,255,255,0.1), rgba(0,0,0,0.6))',
                            // background: " linear-gradient(180deg, rgba(0, 0, 0, 0.2112) 0%, rgba(0, 0, 0, 0.6336) 100%)linear-gradient(180deg, rgba(8, 40, 56, 0.24) 0%, rgba(2, 3, 4, 0.72) 100%)",

                            color: '#fff',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '30px',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                            backgroundClip: 'padding-box',
                            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.8)',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            fontWeight: 'bold'
                        }}
                    >
                        WELCOME
                    </button>

                </Link>
            </div>
            <div
                style={{
                    position: 'absolute',
                    bottom: '1rem',
                    right: '1rem',
                    fontSize: '3rem',
                    fontWeight: 'bold',
                    color: 'white',
                    zIndex: 1
                }}
            >
                <img width={"60"} height={"77"} src='./logo.png' />
            </div>
        </div>
    )
}

export default Screen0
