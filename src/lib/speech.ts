import type { Card } from '../types';

let current: HTMLAudioElement | null = null;

/** Play the card's recording, or fall back to the browser's Chinese voice. */
export function speak(card: Pick<Card, 'audio' | 'hanzi'>) {
  current?.pause();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (card.audio) {
    current = new Audio(card.audio);
    current.play().catch(() => {});
    return;
  }
  if (!card.hanzi || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(card.hanzi);
  u.lang = 'zh-CN';
  u.rate = 0.85;
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('zh'));
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}
