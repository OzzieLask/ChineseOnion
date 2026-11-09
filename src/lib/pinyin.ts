import { pinyin } from 'pinyin-pro';

const HAN = /\p{Script=Han}/u;
export const hasHanzi = (s: string) => HAN.test(s);

export function toPinyin(hanzi: string): string {
  if (!hasHanzi(hanzi)) return '';
  return pinyin(hanzi, { toneType: 'symbol', nonZh: 'consecutive' }).trim();
}
