import type { Card } from '../types';
import { newSrs } from './srs';
import { toPinyin } from './pinyin';
import { uid } from './util';

export function blankCard(): Card {
  const now = Date.now();
  return {
    id: uid(),
    hanzi: '',
    pinyin: '',
    meaning: '',
    notes: '',
    tags: [],
    audio: null,
    image: null,
    drawing: null,
    tts: null,
    ttsKey: null,
    srs: newSrs(now),
    createdAt: now,
    updatedAt: now,
  };
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Coerce anything that looks like a card (e.g. from an imported JSON file) into a valid Card. */
export function normalizeCard(raw: unknown): Card | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const hanzi = str(r.hanzi ?? r.character ?? r.front);
  const meaning = str(r.meaning ?? r.translation ?? r.back);
  if (!hanzi && !meaning) return null;
  const base = blankCard();
  const s = (r.srs ?? {}) as Record<string, unknown>;
  return {
    ...base,
    id: str(r.id) || base.id,
    hanzi,
    pinyin: str(r.pinyin) || toPinyin(hanzi),
    meaning,
    notes: str(r.notes),
    tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : [],
    audio: str(r.audio) || null,
    image: str(r.image) || null,
    drawing: str(r.drawing) || null,
    tts: str(r.tts) || null,
    ttsKey: str(r.ttsKey) || null,
    srs: {
      due: num(s.due, base.srs.due),
      interval: num(s.interval, 0),
      ease: num(s.ease, 2.5),
      reps: num(s.reps, 0),
      lapses: num(s.lapses, 0),
      last: typeof s.last === 'number' ? s.last : undefined,
    },
    createdAt: num(r.createdAt, base.createdAt),
    updatedAt: num(r.updatedAt, base.updatedAt),
  };
}

export const ttsKeyOf = (c: Pick<Card, 'hanzi' | 'pinyin'>) => `${c.hanzi.trim()}|${c.pinyin.trim()}`;

/** Card has Chinese text whose generated audio is missing or out of date. */
export const needsTts = (c: Card) => /\p{Script=Han}/u.test(c.hanzi) && c.ttsKey !== ttsKeyOf(c);

export function sampleCards(): Card[] {
  const rows: [string, string, string[]][] = [
    ['你好', 'hello', ['basics']],
    ['谢谢', 'thank you', ['basics']],
    ['一', 'one', ['numbers']],
    ['二', 'two', ['numbers']],
    ['三', 'three', ['numbers']],
    ['米饭', 'cooked rice', ['food']],
    ['饺子', 'dumplings', ['food']],
    ['洋葱', 'onion', ['food']],
  ];
  return rows.map(([hanzi, meaning, tags], i) => ({
    ...blankCard(),
    hanzi,
    pinyin: toPinyin(hanzi),
    meaning,
    tags,
    createdAt: Date.now() - (rows.length - i) * 1000,
  }));
}
