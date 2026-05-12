import { useId, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext.jsx';
import {
  darkenRgb,
  hexToRgb,
  lightenRgb,
  normalizePrimaryHex,
} from '../theme/primaryTheme.js';

function toHex({ r, g, b }) {
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Branded top bar mark for stylist home — colors track `ThemeContext` / `--salonx-primary`.
 */
export function StylistTopBarBrandSvg() {
  const { primaryHex } = useTheme();
  const rawId = useId().replace(/:/g, '');
  const uid = `s1b_${rawId}`;

  const colors = useMemo(() => {
    const base = hexToRgb(primaryHex);
    const primary = normalizePrimaryHex(primaryHex);
    return {
      line: primary,
      fill0a: toHex(lightenRgb(base, 0.14)),
      fill0b: toHex(darkenRgb(base, 0.2)),
      stroke1a: toHex(darkenRgb(base, 0.32)),
      stroke1b: toHex(lightenRgb(base, 0.18)),
      arc0: primary,
    };
  }, [primaryHex]);

  const f0 = `${uid}_f0`;
  const f1 = `${uid}_f1`;
  const clip = `${uid}_clip`;
  const p0 = `${uid}_p0`;
  const p1 = `${uid}_p1`;
  const p2 = `${uid}_p2`;

  return (
    <svg
      className="s1demo-brandBar__svg"
      width="532"
      height="166"
      viewBox="0 0 266 83"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <line
        y1="32.4844"
        x2="266"
        y2="32.4844"
        stroke={colors.line}
        strokeWidth="2"
      />
      <g filter={`url(#${f0})`}>
        <foreignObject
          x="137.186"
          y="-0.000448227"
          width="82.5194"
          height="82.5175"
        >
          {/* eslint-disable-next-line react/no-unknown-property */}
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              backdropFilter: 'blur(8.15px)',
              clipPath: `url(#${clip})`,
              height: '100%',
              width: '100%',
            }}
          />
        </foreignObject>
        <g filter={`url(#${f1})`}>
          <circle cx="178.444" cy="33.1104" r="8.66702" fill={`url(#${p0})`} />
          <circle
            cx="178.444"
            cy="33.1104"
            r="8.16702"
            fill="none"
            stroke={`url(#${p1})`}
          />
        </g>
      </g>
      <path
        d="M172.911 44.5902C174.888 45.5853 177.083 46.0682 179.296 45.9945C181.508 45.9208 183.666 45.2929 185.572 44.1685C187.479 43.044 189.072 41.4589 190.207 39.5585C191.342 37.6581 191.981 35.5033 192.067 33.2916C192.152 31.0799 191.681 28.8821 190.697 26.8997C189.712 24.9174 188.246 23.2139 186.432 21.9455C184.618 20.6771 182.515 19.8844 180.315 19.64C178.115 19.3957 175.889 19.7075 173.841 20.5469"
        stroke={`url(#${p2})`}
        strokeWidth="1.60021"
      />
      <defs>
        <filter
          id={f0}
          x="149.41"
          y="9.16796"
          width="58.0703"
          height="58.0684"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="5.0918" />
          <feGaussianBlur stdDeviation="10.1836" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.16 0"
          />
          <feBlend
            mode="normal"
            in2="BackgroundImageFix"
            result="effect1_dropShadow_67_2243"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_67_2243"
            result="shape"
          />
        </filter>
        <filter
          id={f1}
          x="137.186"
          y="-0.000448227"
          width="82.5194"
          height="82.5175"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="8.14794" />
          <feGaussianBlur stdDeviation="16.2959" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.16 0"
          />
          <feBlend
            mode="normal"
            in2="BackgroundImageFix"
            result="effect1_dropShadow_67_2243"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_67_2243"
            result="shape"
          />
        </filter>
        <clipPath
          id={clip}
          transform="translate(-137.186 0.000448227)"
        >
          <circle cx="178.444" cy="33.1104" r="8.66702" />
        </clipPath>
        <linearGradient
          id={p0}
          x1="185.648"
          y1="31.7101"
          x2="169.73"
          y2="31.7101"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={colors.fill0a} />
          <stop offset="1" stopColor={colors.fill0b} />
        </linearGradient>
        <linearGradient
          id={p1}
          x1="191.026"
          y1="33.4407"
          x2="172.982"
          y2="37.5754"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={colors.stroke1a} />
          <stop offset="1" stopColor={colors.stroke1b} />
        </linearGradient>
        <linearGradient
          id={p2}
          x1="193.797"
          y1="33.4393"
          x2="175.815"
          y2="33.4393"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={colors.arc0} />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
