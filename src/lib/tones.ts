/** Tone data + pinyin helpers shared by the tones guide, quiz and pronunciation pipeline. */

export type Tone = 1 | 2 | 3 | 4 | 5;

export interface ToneInfo {
  n: Tone;
  name: string;
  /** Chao tone letters on the 1 (low) – 5 (high) pitch scale */
  contour: number[];
  chao: string;
  feel: string;
  how: string;
  /** cue for learners whose first language is English */
  like: string;
}

export const TONES: ToneInfo[] = [
  {
    n: 1,
    name: 'First · high level',
    contour: [5, 5],
    chao: '55',
    feel: 'High and flat, held steady.',
    how: 'Start near the top of your comfortable range and hold it like a sung note. Don’t let it sag at the end.',
    like: 'A doctor’s “ahhh”, or singing one long note.',
  },
  {
    n: 2,
    name: 'Second · rising',
    contour: [3, 5],
    chao: '35',
    feel: 'From middle up to high.',
    how: 'Start mid and rise smoothly and quickly. Lift your eyebrows if it helps.',
    like: 'A surprised “huh?” or “what?”.',
  },
  {
    n: 3,
    name: 'Third · low dipping',
    contour: [2, 1, 4],
    chao: '214',
    feel: 'Low, often creaky. Only rises at the end of a phrase.',
    how: 'Drop to the bottom of your voice and relax your throat. Mid-sentence it usually stays low (a “half third”, 21) and doesn’t rise.',
    like: 'A doubtful, low “well…” or “hmm”.',
  },
  {
    n: 4,
    name: 'Fourth · falling',
    contour: [5, 1],
    chao: '51',
    feel: 'Sharp drop from high to low.',
    how: 'Start high and fall fast and decisively. It’s short, not drawn out.',
    like: 'A firm “No!” or “Stop!”.',
  },
  {
    n: 5,
    name: 'Neutral · light',
    contour: [3],
    chao: '·',
    feel: 'Short and unstressed.',
    how: 'Say it quickly and lightly. Its pitch follows the syllable before it: higher after tone 3, lower after tones 1, 2 and 4.',
    like: 'The “-er” in “butter”.',
  },
];

export const TONE_EXAMPLE: Record<Tone, { py: string; hz: string; en: string }> = {
  1: { py: 'mā', hz: '妈', en: 'mother' },
  2: { py: 'má', hz: '麻', en: 'hemp' },
  3: { py: 'mǎ', hz: '马', en: 'horse' },
  4: { py: 'mà', hz: '骂', en: 'to scold' },
  5: { py: 'ma', hz: '吗', en: 'question particle' },
};

/**
 * Practice syllables that exist in all four tones, with a common character for each.
 * Keep in sync with supabase/functions/tts/index.ts (PRESETS).
 */
export const PRACTICE: Record<string, [string, string, string, string]> = {
  ma: ['妈', '麻', '马', '骂'],
  ba: ['八', '拔', '把', '爸'],
  yi: ['一', '姨', '椅', '意'],
  wu: ['屋', '无', '五', '雾'],
  shi: ['师', '十', '使', '是'],
  tang: ['汤', '糖', '躺', '烫'],
  fu: ['夫', '服', '斧', '父'],
  di: ['低', '敌', '底', '地'],
  qi: ['七', '骑', '起', '气'],
  tu: ['突', '图', '土', '兔'],
  hu: ['呼', '湖', '虎', '户'],
  ying: ['英', '赢', '影', '硬'],
  guo: ['锅', '国', '果', '过'],
  bao: ['包', '薄', '宝', '报'],
  zhu: ['猪', '竹', '主', '住'],
  xi: ['西', '习', '洗', '细'],
  tong: ['通', '同', '统', '痛'],
};

const MARKS: Record<string, [string, Tone]> = {};
for (const [base, row] of Object.entries({
  a: 'āáǎà',
  e: 'ēéěè',
  i: 'īíǐì',
  o: 'ōóǒò',
  u: 'ūúǔù',
  ü: 'ǖǘǚǜ',
})) {
  [...row].forEach((ch, i) => (MARKS[ch] = [base, (i + 1) as Tone]));
}

export interface Syllable {
  /** plain spelling, ü kept as ü */
  base: string;
  tone: Tone;
}

/** Parse "nǐ hǎo", "ni3 hao3" or "ni hao" (neutral) into syllables. One token per syllable. */
export function parsePinyin(pinyin: string): Syllable[] {
  return pinyin
    .toLowerCase()
    .replace(/[^\p{L}\p{M}0-9\s'’-]/gu, ' ')
    .split(/[\s'’-]+/)
    .filter(Boolean)
    .map((tok) => {
      const t = tok.normalize('NFC');
      const num = t.match(/^([a-zü:v]+)([1-5])$/);
      if (num) return { base: num[1].replace(/v|u:/g, 'ü'), tone: Number(num[2]) as Tone };
      let tone: Tone = 5;
      let base = '';
      for (const ch of t) {
        const m = MARKS[ch];
        if (m) {
          base += m[0];
          tone = m[1];
        } else base += ch;
      }
      return { base: base.replace(/v/g, 'ü'), tone };
    });
}

const HAN = /\p{Script=Han}/gu;

/**
 * Azure "sapi" phoneme string, e.g. "ni 3 - hao 3". Only produced when the pinyin
 * has exactly one syllable per character, so it can't misalign.
 */
export function toSapi(hanzi: string, pinyin: string): string | null {
  const chars = hanzi.match(HAN) ?? [];
  const syl = parsePinyin(pinyin);
  if (!chars.length || chars.length !== syl.length) return null;
  if (syl.some((s) => !/^[a-zü]+$/.test(s.base))) return null;
  return syl.map((s) => `${s.base.replace(/üe/g, 'ue').replace(/ü/g, 'v')} ${s.tone}`).join(' - ');
}

/** Put the tone mark on the right vowel: a/e first, then the o in "ou", else the last vowel. */
export function markTone(base: string, tone: Tone): string {
  if (tone === 5) return base;
  const vowels = 'aeiouü';
  let idx = base.search(/[ae]/);
  if (idx < 0) idx = base.indexOf('ou');
  if (idx < 0) for (let i = base.length - 1; i >= 0; i--) if (vowels.includes(base[i])) { idx = i; break; }
  if (idx < 0) return base;
  const v = base[idx];
  const marked = Object.entries(MARKS).find(([, [b, t]]) => b === v && t === tone)?.[0] ?? v;
  return base.slice(0, idx) + marked + base.slice(idx + 1);
}

/** SVG path for a contour on a w×h box (pitch 1 = bottom, 5 = top). */
export function contourPath(contour: number[], w: number, h: number, pad = 6): string {
  const y = (p: number) => pad + ((5 - p) / 4) * (h - pad * 2);
  if (contour.length === 1) {
    const cy = y(contour[0]);
    return `M ${w / 2 - w * 0.08} ${cy} L ${w / 2 + w * 0.08} ${cy}`;
  }
  const xs = contour.map((_, i) => pad + (i / (contour.length - 1)) * (w - pad * 2));
  if (contour.length === 2) return `M ${xs[0]} ${y(contour[0])} L ${xs[1]} ${y(contour[1])}`;
  // smooth dip for tone 3
  return `M ${xs[0]} ${y(contour[0])} Q ${xs[1]} ${y(contour[1]) + (h - pad * 2) * 0.12} ${xs[2]} ${y(contour[2])}`;
}
