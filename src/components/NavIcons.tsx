import { motion, type Variants } from 'motion/react';

/*
 * Tab icons with their own hover/tap personality. The parent button sets
 * whileHover="hover" / whileTap="hover", and the variants below propagate down.
 */

const svgProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  style: { overflow: 'visible' as const },
};

/** Graduation cap tosses up with a spin; tassel swings. */
export function StudyIcon() {
  const cap: Variants = {
    rest: { y: 0, rotate: 0 },
    hover: { y: [0, -7, 0], rotate: [0, -18, 10, 0], transition: { duration: 0.65, ease: 'easeOut' } },
  };
  const tassel: Variants = {
    rest: { rotate: 0 },
    hover: { rotate: [0, 35, -25, 12, 0], transition: { duration: 0.9 } },
  };
  return (
    <svg {...svgProps}>
      <motion.g variants={cap} style={{ originX: '50%', originY: '60%' }}>
        <path d="M12 4l9 4.5-9 4.5-9-4.5z" />
        <path d="M6.5 10.5V15c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-4.5" />
        <motion.path d="M21 8.5v5" variants={tassel} style={{ originX: '50%', originY: '0%' }} />
      </motion.g>
    </svg>
  );
}

/** Two cards fan apart like a hand of cards. */
export function CardsIcon() {
  const back: Variants = { rest: { rotate: 0, x: 0 }, hover: { rotate: -16, x: -2, transition: { type: 'spring', stiffness: 400, damping: 12 } } };
  const front: Variants = { rest: { rotate: 0, x: 0 }, hover: { rotate: 12, x: 2, transition: { type: 'spring', stiffness: 400, damping: 12 } } };
  return (
    <svg {...svgProps}>
      <motion.rect x="7" y="3.5" width="12" height="15" rx="2" variants={back} style={{ originX: '50%', originY: '100%' }} />
      <motion.rect
        x="4.5"
        y="6"
        width="12"
        height="15"
        rx="2"
        fill="var(--nav-icon-fill)"
        variants={front}
        style={{ originX: '50%', originY: '100%' }}
      />
    </svg>
  );
}

/** Equalizer bars bounce like a voice saying four tones. */
export function TonesIcon() {
  const heights = [6, 12, 4, 10];
  return (
    <svg {...svgProps}>
      {heights.map((h, i) => (
        <motion.line
          key={i}
          x1={4.5 + i * 5}
          x2={4.5 + i * 5}
          y1={12 - h / 2}
          y2={12 + h / 2}
          variants={{
            rest: { scaleY: 1 },
            hover: {
              scaleY: [1, 1.7, 0.5, 1.3, 1],
              transition: { duration: 0.7, delay: i * 0.07, ease: 'easeInOut' },
            },
          }}
          style={{ originY: '50%' }}
        />
      ))}
    </svg>
  );
}

/** Gear turns a quarter with a springy overshoot. */
export function SettingsIcon() {
  return (
    <svg {...svgProps}>
      <motion.g
        variants={{ rest: { rotate: 0 }, hover: { rotate: 120, transition: { type: 'spring', stiffness: 180, damping: 9 } } }}
        style={{ originX: '50%', originY: '50%' }}
      >
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
        <path d="M19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2.1 1.2L14.7 21h-4l-.3-2.1a7 7 0 0 1-2.1-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-2.4L4.4 9.9l2-3.4 1.9.7a7 7 0 0 1 2.1-1.2L10.7 3h4l.3 2.1a7 7 0 0 1 2.1 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 2.4z" />
      </motion.g>
    </svg>
  );
}
