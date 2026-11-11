import { motion } from 'motion/react';
import { contourPath, TONES, type Tone } from '../lib/tones';

/** One tone's pitch contour. `playKey` changes retrigger the draw animation. */
export function ToneContour({
  tone,
  w = 64,
  h = 40,
  grid = false,
  playKey = 0,
  strokeWidth = 4,
}: {
  tone: Tone;
  w?: number;
  h?: number;
  grid?: boolean;
  playKey?: number;
  strokeWidth?: number;
}) {
  const info = TONES[tone - 1];
  const d = contourPath(info.contour, w, h, strokeWidth + 2);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="contour" aria-hidden="true">
      {grid &&
        [1, 2, 3, 4, 5].map((p) => {
          const y = strokeWidth + 2 + ((5 - p) / 4) * (h - (strokeWidth + 2) * 2);
          return <line key={p} x1={0} x2={w} y1={y} y2={y} className="contour-grid" />;
        })}
      <motion.path
        key={playKey}
        d={d}
        fill="none"
        stroke={`var(--t${tone})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0.4 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: tone === 5 ? 0.2 : 0.55, ease: 'easeInOut' }}
      />
    </svg>
  );
}
