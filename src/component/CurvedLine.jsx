import {
  CURVE_BODY_PATH,
  CURVE_STROKE_PATH,
  CURVE_VIEWBOX_H,
  CURVE_VIEWBOX_W,
} from './curvePaths';

/** Right-edge decorative strip for Screen1.
 *  Width/height are 100% — the SVG fills `.curvedline-container`'s slot.
 *
 *  @param {{ part?: 'full' | 'body' | 'stroke' }} [props]
 *    `full` — black body + stroke (no strip media).
 *    `body` / `stroke` — split stack: body under strip media, stroke on top.
 */

const SVG_PROPS = {
  width: '100%',
  height: '100%',
  viewBox: `0 0 ${CURVE_VIEWBOX_W} ${CURVE_VIEWBOX_H}`,
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  preserveAspectRatio: 'none',
  'aria-hidden': true,
};

function CurvedLine({ part = 'full' }) {
  if (part === 'body') {
    return (
      <svg {...SVG_PROPS} className="curvedline-svg curvedline-svg--bodyFill">
        <path d={CURVE_BODY_PATH} fill="#000000" />
      </svg>
    );
  }

  if (part === 'stroke') {
    return (
      <svg {...SVG_PROPS} className="curvedline-svg curvedline-svg--stroke">
        <path d={CURVE_STROKE_PATH} fill="var(--salonx-primary)" />
      </svg>
    );
  }

  return (
    <svg {...SVG_PROPS} className="curvedline-svg curvedline-svg--full">
      <path d={CURVE_BODY_PATH} fill="#000000" />
      <path d={CURVE_STROKE_PATH} fill="var(--salonx-primary)" />
    </svg>
  );
}

export default CurvedLine;
