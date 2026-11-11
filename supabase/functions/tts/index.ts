// Supabase Edge Function: Mandarin pronunciation via Azure neural TTS.
//
//   POST { text, ph? }   owner only. Speaks a card. `ph` = Azure sapi pinyin, e.g. "ni 3 - hao 3".
//   POST { preset }      anyone. One practice syllable for the tones guide, e.g. "ma3".
//
// Every clip is cached in the public `media` bucket under tts/, so each one is only paid for once.
//
// Secrets (Dashboard > Edge Functions > Secrets, or `supabase secrets set`):
//   AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, OWNER_EMAIL, optional AZURE_VOICE

import { createClient } from 'npm:@supabase/supabase-js@2';

const AZURE_KEY = Deno.env.get('AZURE_SPEECH_KEY') ?? '';
const AZURE_REGION = Deno.env.get('AZURE_SPEECH_REGION') ?? '';
const OWNER_EMAIL = (Deno.env.get('OWNER_EMAIL') ?? '').toLowerCase();
const VOICE = Deno.env.get('AZURE_VOICE') ?? 'zh-CN-XiaoxiaoNeural';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Keep in sync with src/lib/tones.ts (PRACTICE)
const PRESETS: Record<string, string[]> = {
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

// Tone-change examples on the tones page. Keep in sync with src/pages/TonesPage.tsx (RULES).
const PHRASES = ['你好', '水果', '老师', '好吃', '不是', '不要', '一个', '一天', '第一', '妈妈', '谢谢', '东西'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

async function sha(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function synth(text: string, ph: string | null, rate: string): Promise<ArrayBuffer> {
  const say = (withPh: boolean) => {
    const inner = withPh && ph ? `<phoneme alphabet="sapi" ph="${esc(ph)}">${esc(text)}</phoneme>` : esc(text);
    const ssml =
      `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">` +
      `<voice name="${VOICE}"><prosody rate="${rate}">${inner}</prosody></voice></speak>`;
    return fetch(`https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
        'User-Agent': 'chinese-onion',
      },
      body: ssml,
    });
  };
  let res = await say(true);
  // If Azure rejects the pinyin hint, fall back to its own reading rather than failing.
  if (!res.ok && ph) res = await say(false);
  if (!res.ok) throw new Error(`Azure TTS ${res.status}: ${await res.text()}`);
  const audio = await res.arrayBuffer();
  if (audio.byteLength < 200) throw new Error('Azure returned empty audio');
  return audio;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!AZURE_KEY || !AZURE_REGION) return json({ error: 'AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not set' }, 500);

  let body: { text?: string; ph?: string; preset?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad JSON' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  let text: string;
  let ph: string | null = null;
  let rate = '-5%';
  let path: string;

  if (body.preset?.startsWith('p:')) {
    const phrase = body.preset.slice(2);
    if (!PHRASES.includes(phrase)) return json({ error: 'Unknown preset' }, 400);
    text = phrase;
    rate = '-15%';
    path = `tts/preset/${VOICE}/p-${await sha(phrase)}.mp3`;
  } else if (body.preset) {
    const m = /^([a-z]+)([1-4])$/.exec(body.preset);
    const chars = m && PRESETS[m[1]];
    if (!m || !chars) return json({ error: 'Unknown preset' }, 400);
    text = chars[Number(m[2]) - 1];
    ph = `${m[1]} ${m[2]}`;
    rate = '-15%';
    path = `tts/preset/${VOICE}/${body.preset}.mp3`;
  } else {
    // Card audio: owner only.
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data } = await admin.auth.getUser(jwt);
    if (!data.user?.email || data.user.email.toLowerCase() !== OWNER_EMAIL) return json({ error: 'Owner only' }, 403);

    text = (body.text ?? '').trim();
    if (!text || text.length > 200) return json({ error: 'text must be 1–200 characters' }, 400);
    if (body.ph) {
      if (!/^[a-z]+ [1-5]( - [a-z]+ [1-5])*$/.test(body.ph)) return json({ error: 'Bad ph' }, 400);
      ph = body.ph;
    }
    path = `tts/${await sha(`${VOICE}|${text}|${ph ?? ''}`)}.mp3`;
  }

  const publicUrl = admin.storage.from('media').getPublicUrl(path).data.publicUrl;

  // Cached already?
  const head = await fetch(publicUrl, { method: 'HEAD' });
  if (head.ok) return json({ url: publicUrl, cached: true });

  try {
    const audio = await synth(text, ph, rate);
    const { error } = await admin.storage
      .from('media')
      .upload(path, new Blob([audio], { type: 'audio/mpeg' }), { contentType: 'audio/mpeg', upsert: true });
    if (error) throw error;
    return json({ url: publicUrl, cached: false });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
});
