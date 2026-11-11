import { useEffect, useMemo } from 'react';
import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react';

/*
 * Ambient background: three depth layers of bamboo silhouettes that sway,
 * drift with scroll (parallax) and lean slightly toward the pointer.
 * Purely decorative: pointer-events off, aria-hidden, and motion is skipped
 * for people who prefer reduced motion (MotionConfig in App).
 */

interface Leaf {
  angle: number;
  len: number;
}
interface Cluster {
  y: number;
  side: 1 | -1;
  leaves: Leaf[];
}
interface Stalk {
  x: number; // vw %
  w: number; // stalk thickness px
  seg: number;
  height: number;
  layer: 0 | 1 | 2;
  sway: number;
  dur: number;
  delay: number;
  clusters: Cluster[];
  hideMobile?: boolean;
}

// Small seeded RNG so the grove looks the same on every visit.
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function makeGrove(): Stalk[] {
  const r = rng(7);
  const spots: [number, 0 | 1 | 2, boolean?][] = [
    [3, 2], [9, 1], [15, 0], [21, 0, true], [33, 0, true], [64, 0, true],
    [76, 0, true], [83, 0], [88, 1], [95, 2], [99, 1],
  ];
  return spots.map(([x, layer, hideMobile]) => {
    const w = [7, 11, 16][layer] + r() * 3;
    const height = 900 + r() * 500;
    const seg = 90 + r() * 70;
    const clusters: Cluster[] = [];
    for (let y = seg * (1.5 + r()); y < height - 60; y += seg * (1 + Math.floor(r() * 2))) {
      if (r() < 0.55) {
        const side = (r() < 0.5 ? 1 : -1) as 1 | -1;
        const n = 2 + Math.floor(r() * 3);
        clusters.push({
          y,
          side,
          leaves: Array.from({ length: n }, (_, i) => ({
            angle: 18 + i * (20 + r() * 12) + r() * 8,
            len: (55 + r() * 55) * (0.7 + layer * 0.2),
          })),
        });
      }
    }
    return {
      x,
      w,
      seg,
      height,
      layer,
      sway: 0.6 + r() * 1.1,
      dur: 7 + r() * 6,
      delay: -r() * 8,
      clusters,
      hideMobile,
    };
  });
}

function StalkSvg({ s }: { s: Stalk }) {
  const W = 260; // room for leaves on both sides
  const cx = W / 2;
  const segs: number[] = [];
  for (let y = s.height; y > 0; y -= s.seg) segs.push(y);
  return (
    <motion.svg
      className={`bamboo-stalk layer-${s.layer}${s.hideMobile ? ' hide-mobile' : ''}`}
      width={W}
      height={s.height}
      viewBox={`0 0 ${W} ${s.height}`}
      style={{ left: `calc(${s.x}vw - ${cx}px)`, originX: '50%', originY: '100%' }}
      animate={{ rotate: [-s.sway, s.sway] }}
      transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
    >
      {segs.map((y, i) => {
        const top = Math.max(0, y - s.seg);
        return (
          <g key={i}>
            <rect x={cx - s.w / 2} y={top + 2.5} width={s.w} height={y - top - 5} rx={s.w * 0.35} />
            {/* node ring */}
            <rect x={cx - s.w / 2 - 1.5} y={top - 1.5} width={s.w + 3} height={3} rx={1.5} />
          </g>
        );
      })}
      {s.clusters.map((c, i) => (
        <motion.g
          key={i}
          // leaves droop from the twig, so pivot at the attachment corner of the cluster's box
          style={{ originX: c.side === 1 ? '0%' : '100%', originY: '0%' }}
          animate={{ rotate: [0, c.side * 3, 0] }}
          transition={{ duration: 3 + (i % 3), repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
        >
          {/* twig */}
          <line x1={cx} y1={c.y} x2={cx + c.side * 14} y2={c.y - 10} strokeWidth={2} />
          {c.leaves.map((l, j) => {
            const width = l.len * 0.13;
            const d = `M0 0 Q ${l.len * 0.4} ${-width} ${l.len} 0 Q ${l.len * 0.4} ${width} 0 0 Z`;
            const rot = c.side === 1 ? l.angle : 180 - l.angle;
            return <path key={j} d={d} transform={`translate(${cx + c.side * 14} ${c.y - 10}) rotate(${rot})`} />;
          })}
        </motion.g>
      ))}
    </motion.svg>
  );
}

export function Bamboo() {
  const grove = useMemo(makeGrove, []);
  const { scrollY } = useScroll();
  const px = useMotionValue(0);
  const spx = useSpring(px, { stiffness: 40, damping: 18 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => px.set(e.clientX / window.innerWidth - 0.5);
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [px]);

  // Far layers move less: depth.
  const y0 = useTransform(scrollY, (v) => v * -0.04);
  const y1 = useTransform(scrollY, (v) => v * -0.1);
  const y2 = useTransform(scrollY, (v) => v * -0.18);
  const x0 = useTransform(spx, (v) => v * -6);
  const x1 = useTransform(spx, (v) => v * -14);
  const x2 = useTransform(spx, (v) => v * -26);
  const motionFor = [
    { x: x0, y: y0 },
    { x: x1, y: y1 },
    { x: x2, y: y2 },
  ];

  return (
    <div className="bamboo" aria-hidden="true">
      {[0, 1, 2].map((layer) => (
        <motion.div key={layer} className={`bamboo-layer layer-${layer}`} style={motionFor[layer]}>
          {grove
            .filter((s) => s.layer === layer)
            .map((s, i) => (
              <StalkSvg key={i} s={s} />
            ))}
        </motion.div>
      ))}
    </div>
  );
}
