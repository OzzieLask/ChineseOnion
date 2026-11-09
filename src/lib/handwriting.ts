/** One stroke = [xs, ys, times], the format Google Input Tools expects. */
export type Stroke = [number[], number[], number[]];

const ENDPOINT = 'https://inputtools.google.com/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8';

export async function recognize(
  strokes: Stroke[],
  width: number,
  height: number,
  signal?: AbortSignal,
): Promise<string[]> {
  if (!strokes.length) return [];
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      options: 'enable_pre_space',
      requests: [
        {
          writing_guide: { writing_area_width: width, writing_area_height: height },
          ime: 'handwriting',
          language: 'zh_CN',
          ink: strokes,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Recognition failed (${res.status})`);
  const json = await res.json();
  if (json[0] !== 'SUCCESS') throw new Error('Recognition failed');
  const list: string[] = json[1]?.[0]?.[1] ?? [];
  return list.filter((c) => /^\p{Script=Han}+$/u.test(c)).slice(0, 8);
}

export interface Sketch {
  strokes: Stroke[];
  size: number;
}

/** Render hand-drawn characters side by side into one PNG strip. */
export function renderSketches(sketches: Sketch[], cell = 160): Promise<Blob | null> {
  if (!sketches.length) return Promise.resolve(null);
  const c = document.createElement('canvas');
  c.width = cell * sketches.length;
  c.height = cell;
  const ctx = c.getContext('2d')!;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#2b2530';
  ctx.lineWidth = Math.max(3, cell / 28);
  sketches.forEach((s, i) => {
    const k = cell / s.size;
    for (const [xs, ys] of s.strokes) {
      ctx.beginPath();
      xs.forEach((x, j) => {
        const px = i * cell + x * k;
        const py = ys[j] * k;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      if (xs.length === 1) ctx.lineTo(i * cell + xs[0] * k + 0.1, ys[0] * k);
      ctx.stroke();
    }
  });
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}
