export type Face = 'audio' | 'hanzi' | 'pinyin' | 'meaning';
export const FACES: { id: Face; label: string }[] = [
  { id: 'hanzi', label: 'Character' },
  { id: 'pinyin', label: 'Pinyin' },
  { id: 'meaning', label: 'Meaning' },
  { id: 'audio', label: 'Audio' },
];

export interface SrsState {
  /** epoch ms when next due */
  due: number;
  /** days (fractional while learning) */
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  last?: number;
}

export interface Card {
  id: string;
  hanzi: string;
  pinyin: string;
  meaning: string;
  notes: string;
  tags: string[];
  /** URLs: Supabase public URL, or a data: URL in local mode */
  audio: string | null;
  image: string | null;
  drawing: string | null;
  /** Generated neural-voice pronunciation (used when there's no recording). */
  tts: string | null;
  /** hanzi|pinyin the tts clip was made from, so edits trigger a regenerate. */
  ttsKey: string | null;
  srs: SrsState;
  createdAt: number;
  updatedAt: number;
}

export interface Prefs {
  showPinyin: boolean;
  front: Face[];
  studyTags: string[];
  studyMode: 'review' | 'shuffle';
}
