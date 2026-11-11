import { useState } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../store';
import { markTone, PRACTICE, TONES, type Tone } from '../lib/tones';
import { playPhrase, playSyllable } from '../lib/toneAudio';
import { ToneContour } from '../components/ToneContour';
import { ToneQuiz } from '../components/ToneQuiz';
import { Icon } from '../components/Icon';

// Every example here must be in PHRASES in supabase/functions/tts/index.ts
const RULES = [
  {
    title: '3 + 3 → 2 + 3',
    body: 'Two third tones in a row: the first one rises like a second tone.',
    ex: [['你好', 'nǐ hǎo', 'ní hǎo'], ['水果', 'shuǐ guǒ', 'shuí guǒ']],
  },
  {
    title: 'Half third tone',
    body: 'Before tones 1, 2, 4 or neutral, a third tone stays low (21) and skips the rise.',
    ex: [['老师', 'lǎo shī', 'lǎo↘ shī'], ['好吃', 'hǎo chī', 'hǎo↘ chī']],
  },
  {
    title: '不 bù → bú before tone 4',
    body: '不 is normally fourth tone but becomes second before another fourth tone.',
    ex: [['不是', 'bù shì', 'bú shì'], ['不要', 'bù yào', 'bú yào']],
  },
  {
    title: '一 yī changes too',
    body: 'Before tone 4 it becomes yí. Before tones 1, 2, 3 it becomes yì. Counting, dates and ordinals keep yī.',
    ex: [['一个', 'yī gè', 'yí gè'], ['一天', 'yī tiān', 'yì tiān'], ['第一', 'dì yī', 'dì yī']],
  },
  {
    title: 'Neutral tone',
    body: 'Particles and many second syllables are light and short: 吗 吧 呢 的 了, and doubled words.',
    ex: [['妈妈', 'mā ma', ''], ['谢谢', 'xiè xie', ''], ['东西', 'dōng xi', '(thing)']],
  },
];

export function TonesPage() {
  const { cloud } = useStore();
  const [syl, setSyl] = useState('ma');
  const [playing, setPlaying] = useState<Record<number, number>>({});

  const play = (t: Tone) => {
    setPlaying((p) => ({ ...p, [t]: (p[t] ?? 0) + 1 }));
    playSyllable(syl, t, cloud);
  };

  return (
    <div className="page tones">
      <section className="panel">
        <div className="row gap-s wrap">
          <h3 className="label">Pitch chart</h3>
          <span className="spacer" />
          <span className="muted small">{cloud ? 'Neural Mandarin voice' : 'Browser voice (connect Supabase for neural audio)'}</span>
        </div>
        <div className="chips scroll-x" role="radiogroup" aria-label="Practice syllable">
          {Object.keys(PRACTICE).map((s) => (
            <motion.button
              key={s}
              role="radio"
              aria-checked={syl === s}
              className={syl === s ? 'chip on' : 'chip'}
              whileTap={{ scale: 0.93 }}
              onClick={() => setSyl(s)}
            >
              {s}
            </motion.button>
          ))}
        </div>

        <div className="tone-chart">
          <div className="tone-scale" aria-hidden="true">
            {[5, 4, 3, 2, 1].map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
          {TONES.map((t) => (
            <motion.button
              key={t.n}
              className={`tone-col t${t.n}`}
              onClick={() => play(t.n)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.96 }}
              aria-label={`Play ${t.name}`}
            >
              <ToneContour tone={t.n} w={88} h={110} grid playKey={playing[t.n] ?? 0} strokeWidth={6} />
              <span className="tone-py">{t.n === 5 ? 'ma' : markTone(syl, t.n)}</span>
              <span className="tone-hz">{t.n === 5 ? '吗' : PRACTICE[syl][t.n - 1]}</span>
              <span className="tone-num">{t.n === 5 ? 'neutral' : `tone ${t.n}`}</span>
            </motion.button>
          ))}
        </div>
        <p className="muted small">
          Numbers are pitch levels (5 = top of your voice, 1 = bottom). Tap a column to hear it.
        </p>
      </section>

      <section className="tone-cards">
        {TONES.map((t, i) => (
          <motion.article
            key={t.n}
            className={`panel tone-card t${t.n}`}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: i * 0.05 }}
          >
            <header className="row gap-s">
              <ToneContour tone={t.n} w={44} h={30} strokeWidth={4} />
              <div>
                <h3>{t.name}</h3>
                <span className="muted small mono">{t.chao}</span>
              </div>
              <span className="spacer" />
              <button className="icon-btn" onClick={() => play(t.n)} aria-label={`Play ${t.name}`}>
                <Icon name="speaker" size={18} />
              </button>
            </header>
            <p className="tone-feel">{t.feel}</p>
            <p className="small">{t.how}</p>
            <p className="muted small">Sounds like: {t.like}</p>
          </motion.article>
        ))}
      </section>

      <section className="panel">
        <h3 className="label">Tone changes (sandhi)</h3>
        <div className="rules">
          {RULES.map((r) => (
            <div key={r.title} className="rule">
              <h4>{r.title}</h4>
              <p className="small muted">{r.body}</p>
              <ul>
                {r.ex.map(([hz, written, said]) => (
                  <li key={hz}>
                    <button className="rule-ex" onClick={() => playPhrase(hz, cloud)} title="Play">
                      <span className="hz">{hz}</span>
                      <span className="pinyin small">{written}</span>
                      {said && <span className="small muted">→ {said}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <ToneQuiz />
    </div>
  );
}
