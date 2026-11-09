import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { recognize, type Sketch, type Stroke } from '../lib/handwriting';
import { Icon } from './Icon';

/**
 * Draw a character. Candidates come from online handwriting recognition;
 * picking one appends it and keeps the sketch so it can be saved on the card.
 */
export function DrawPad({ onPick }: { onPick: (char: string, sketch: Sketch) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const live = useRef<Stroke | null>(null);
  const t0 = useRef(0);
  const [cands, setCands] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const size = () => canvasRef.current?.clientWidth ?? 280;

  const paint = useCallback((all: Stroke[]) => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    if (c.width !== Math.round(w * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(w * dpr);
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, w);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(5, w / 34);
    ctx.strokeStyle = getComputedStyle(c).color;
    for (const [xs, ys] of all) {
      ctx.beginPath();
      xs.forEach((x, i) => (i ? ctx.lineTo(x, ys[i]) : ctx.moveTo(x, ys[i])));
      if (xs.length === 1) ctx.lineTo(xs[0] + 0.1, ys[0]);
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    paint(strokes);
    if (!strokes.length) {
      setCands([]);
      setStatus('idle');
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setStatus('loading');
      try {
        const s = size();
        setCands(await recognize(strokes, s, s, ctrl.signal));
        setStatus('idle');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setStatus('error');
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [strokes, paint]);

  useEffect(() => {
    const onResize = () => paint(strokes);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [strokes, paint]);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [Math.round(e.clientX - r.left), Math.round(e.clientY - r.top)];
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!strokes.length) t0.current = Date.now();
    const [x, y] = pos(e);
    live.current = [[x], [y], [Date.now() - t0.current]];
    paint([...strokes, live.current]);
  };
  const move = (e: React.PointerEvent) => {
    if (!live.current) return;
    const [x, y] = pos(e);
    live.current[0].push(x);
    live.current[1].push(y);
    live.current[2].push(Date.now() - t0.current);
    paint([...strokes, live.current]);
  };
  const up = () => {
    if (!live.current) return;
    const s = live.current;
    live.current = null;
    setStrokes((prev) => [...prev, s]);
  };

  const pick = (ch: string) => {
    onPick(ch, { strokes, size: size() });
    setStrokes([]);
  };

  return (
    <div className="drawpad">
      <div className="drawpad-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="drawpad-canvas"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
        {!strokes.length && <span className="drawpad-hint">draw a character</span>}
      </div>

      <div className="drawpad-cands" aria-live="polite">
        <AnimatePresence mode="popLayout">
          {cands.map((c, i) => (
            <motion.button
              key={c + i}
              type="button"
              className="cand"
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: i * 0.025 } }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => pick(c)}
            >
              {c}
            </motion.button>
          ))}
        </AnimatePresence>
        {status === 'loading' && !cands.length && <span className="muted small">thinking…</span>}
        {status === 'error' && <span className="muted small">Recognition offline. You can still keep the sketch.</span>}
      </div>

      <div className="row gap-s">
        <button type="button" className="btn ghost small" disabled={!strokes.length} onClick={() => setStrokes((s) => s.slice(0, -1))}>
          <Icon name="undo" size={16} /> Undo
        </button>
        <button type="button" className="btn ghost small" disabled={!strokes.length} onClick={() => setStrokes([])}>
          <Icon name="x" size={16} /> Clear
        </button>
        <span className="spacer" />
        <button type="button" className="btn ghost small" disabled={!strokes.length} onClick={() => pick('')}>
          <Icon name="pen" size={16} /> Keep sketch only
        </button>
      </div>
    </div>
  );
}
