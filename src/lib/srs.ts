import type { SrsState } from '../types';

/** 0 = Again, 1 = Hard, 2 = Good, 3 = Easy */
export type Grade = 0 | 1 | 2 | 3;
export const GRADES: { g: Grade; label: string; key: string }[] = [
  { g: 0, label: 'Again', key: '1' },
  { g: 1, label: 'Hard', key: '2' },
  { g: 2, label: 'Good', key: '3' },
  { g: 3, label: 'Easy', key: '4' },
];

const MIN = 60_000;
const DAY = 86_400_000;

export const newSrs = (now = Date.now()): SrsState => ({ due: now, interval: 0, ease: 2.5, reps: 0, lapses: 0 });

/** Simplified SM-2 (Anki-style) scheduler. */
export function schedule(s: SrsState, g: Grade, now = Date.now()): SrsState {
  let { interval, ease } = s;
  const { reps, lapses } = s;
  if (g === 0) {
    return {
      due: now + MIN,
      interval: 0,
      ease: Math.max(1.3, ease - 0.2),
      reps: 0,
      lapses: lapses + (reps > 0 ? 1 : 0),
      last: now,
    };
  }
  let days: number;
  if (reps === 0) {
    days = g === 1 ? 10 / 1440 : g === 2 ? 1 : 4;
  } else {
    const base = Math.max(interval, 1);
    days =
      g === 1 ? Math.max(base * 1.2, base + 1)
      : g === 2 ? Math.max(base * ease, base + 1)
      : Math.max(base * ease * 1.3, base + 2);
  }
  if (g === 1) ease = Math.max(1.3, ease - 0.15);
  if (g === 3) ease = ease + 0.15;
  if (days >= 1) days = Math.round(days);
  interval = days;
  return {
    due: now + days * DAY,
    interval,
    ease,
    reps: g === 1 && reps === 0 ? 0 : reps + 1,
    lapses,
    last: now,
  };
}

export function formatSpan(ms: number): string {
  const m = Math.max(1, Math.round(ms / MIN));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(ms / DAY);
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

export type Comfort = 'new' | 'learning' | 'young' | 'mature';
export function comfort(s: SrsState): Comfort {
  if (!s.last) return 'new';
  if (s.interval < 1) return 'learning';
  if (s.interval < 21) return 'young';
  return 'mature';
}
export const COMFORT_LABEL: Record<Comfort, string> = {
  new: 'New',
  learning: 'Learning',
  young: 'Getting there',
  mature: 'Comfortable',
};

export const isDue = (s: SrsState, now = Date.now()) => s.due <= now;
