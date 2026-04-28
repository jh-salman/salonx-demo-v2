import React from 'react';

function AppointmentCardBorder({
  width = 394,
  height = 78,
  d,
  primaryColor = '#FA1BFE',
  uniqueId = 'card-1',
  fill = '#1A1A1A',
  strokeWidth = 2.5,
  style,
  /**
   * 0..1 — where the bright primaryColor stop sits along the horizontal axis.
   * Default 0.78 keeps the orange peak inside any right-side curve mask.
   */
  brightStop = 0.78,
}) {
  const gradId = `appointmentCardStroke-${uniqueId}`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={style}
      aria-hidden
    >
      <defs>
        <linearGradient
          id={gradId}
          x1={width * brightStop}
          y1={height / 2}
          x2={0}
          y2={height / 2}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor={primaryColor} />
          <stop offset="1" stopColor={primaryColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d={d}
        fill={fill}
        stroke={`url(#${gradId})`}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

export default AppointmentCardBorder;
