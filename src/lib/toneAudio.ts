import { PRACTICE, type Tone } from './tones';
import { presetAudio } from './repo';
import { playUrl, speakText } from './speech';

/** Play one practice syllable: neural voice in cloud mode, browser voice otherwise. */
export async function playSyllable(syl: string, tone: Tone, cloud: boolean) {
  const ch = tone === 5 ? '吗' : PRACTICE[syl][tone - 1];
  if (cloud && tone !== 5) {
    try {
      await playUrl(await presetAudio(`${syl}${tone}`));
      return;
    } catch {
      /* fall through to browser voice */
    }
  }
  speakText(ch);
}

/** Play a whitelisted example phrase (see PHRASES in the tts function). */
export async function playPhrase(hz: string, cloud: boolean) {
  if (cloud) {
    try {
      await playUrl(await presetAudio(`p:${hz}`));
      return;
    } catch {
      /* fall through */
    }
  }
  speakText(hz);
}
