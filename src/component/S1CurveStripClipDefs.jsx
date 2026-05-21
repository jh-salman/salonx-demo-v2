import { CURVE_BODY_PATH, CURVE_VIEWBOX_H, CURVE_VIEWBOX_W } from './curvePaths';

/** Hard clip for curve-strip media — same geometry as CurvedLine body (iOS video ignores CSS masks). */
export default function S1CurveStripClipDefs() {
  const sx = 1 / CURVE_VIEWBOX_W;
  const sy = 1 / CURVE_VIEWBOX_H;

  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <clipPath id="s1-curve-strip-clip" clipPathUnits="objectBoundingBox">
          <path transform={`scale(${sx} ${sy})`} d={CURVE_BODY_PATH} />
        </clipPath>
      </defs>
    </svg>
  );
}
