

const CURVE_PATH_D = "M523 99.5C496 58 503 3 503 3H9.5L3 1315L619.5 1323V1306L618 1242.5C618 1242.5 615.804 1236.73 614.5 1233C607.659 1213.42 606.51 1201.63 601.5 1181.5C593.927 1151.08 589.602 1134.04 582.5 1103.5C575.342 1072.72 571.473 1055.43 565 1024.5C558.151 991.778 554.135 973.453 548.5 940.5C541.323 898.528 537.055 874.933 533.5 832.5C530.807 800.365 529.842 782.247 530 750C530.188 711.657 531.177 690.039 536 652C540.398 617.313 544.899 598.129 552.5 564C560.129 529.746 566.002 510.92 575 477C584.34 441.792 591.452 422.526 599.5 387C607.437 351.963 612.788 332.281 616 296.5C617.782 276.648 620.38 265.289 618 245.5C615.624 225.741 611.699 214.852 604 196.5C584.909 150.991 550 141 523 99.5Z";

function CurvedLine() {
    return (
        <>
            {/* Layer 1 — black backdrop fill (sits behind appointment cards) */}
            <svg width="398" height="885" viewBox="0 0 622 1326" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d={CURVE_PATH_D} fill="black" />
            </svg>

            {/* Layer 2 — pink/blue stroke only, painted on top of cards */}
            <svg
                className="curvedline-stroke-overlay"
                width="398"
                height="885"
                viewBox="0 0 622 1326"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <linearGradient id="paint0_linear_124_63" x1="454" y1="3" x2="563" y2="1277.5" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#ff7819" />
                        <stop offset="1" stopColor="#ff7819" />
                    </linearGradient>
                </defs>
                <path
                    d={CURVE_PATH_D}
                    fill="none"
                    stroke="url(#paint0_linear_124_63)"
                    strokeWidth="5"
                />
            </svg>
        </>
    )
}

export default CurvedLine
