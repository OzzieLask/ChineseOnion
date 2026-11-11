import type { Card } from '../types';

let current: HTMLAudioElement | null = null;

export function playUrl(url: string): Promise<void> {
  current?.pause();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  current = new Audio(url);
  return current.play().catch(() => {});
}

/**
 * Prefer Mainland Mandarin (zh-CN), never Cantonese (zh-HK / yue),
 * and only fall back to Taiwan Mandarin (zh-TW) if nothing else exists.
 * Among matches, prefer the higher-quality "natural"/"online"/"premium" voices.
 */
function mandarinVoice(): SpeechSynthesisVoice | undefined {
  const norm = (l: string) => l.toLowerCase().replace('_', '-');
  const voices = speechSynthesis.getVoices().filter((v) => {
    const l = norm(v.lang);
    return l.startsWith('zh') && !l.includes('hk') && !l.includes('yue') && !/cantonese|粤|粵/i.test(v.name);
  });
  const quality = (v: SpeechSynthesisVoice) => (/natural|online|premium|enhanced|neural/i.test(v.name) ? 1 : 0);
  const rank = (v: SpeechSynthesisVoice) => {
    const l = norm(v.lang);
    const region = l === 'zh-cn' || l.includes('hans') ? 2 : l.includes('tw') || l.includes('hant') ? 0 : 1;
    return region * 2 + quality(v);
  };
  return voices.sort((a, b) => rank(b) - rank(a))[0];
}

// Chrome loads its voice list asynchronously; touch it early so it's ready by the first tap.
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener?.('voiceschanged', () => speechSynthesis.getVoices());
}

/** Browser voice: last resort when no recorded or generated audio exists. */
export function speakText(text: string) {
  current?.pause();
  if (!text || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = 0.85;
  const voice = mandarinVoice();
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}

/** Your recording > generated neural voice > browser voice. */
export function speak(card: Pick<Card, 'audio' | 'tts' | 'hanzi'>) {
  const url = card.audio ?? card.tts;
  if (url) playUrl(url);
  else speakText(card.hanzi);
}

export type AudioSource = 'recording' | 'neural' | 'browser';
export const audioSource = (c: Pick<Card, 'audio' | 'tts'>): AudioSource =>
  c.audio ? 'recording' : c.tts ? 'neural' : 'browser';
