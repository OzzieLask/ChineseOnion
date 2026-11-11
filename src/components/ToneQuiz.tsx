import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../store';
import type { Card } from '../types';
import { markTone, parsePinyin, PRACTICE, type Tone } from '../lib/tones';
import { speak } from '../lib/speech';
import { shuffle } from '../lib/util';
import { playSyllable } from '../lib/toneAudio';
import { ToneContour } from './ToneContour';
import { Segmented } from '../pages/StudyPage';
import { Icon } from './Icon';

const ROUND = 10;

type Q =
  | { kind: 'syl'; syl: string; tone: Tone }
  | { kind: 'card'; card: Card; tones: Tone[]; bases: string[] };

function makeSylRound(): Q[] {
  const syls = Object.keys(PRACTICE);
  return Array.from({ length: ROUND }, () => ({
    kind: 'syl' as const,
    syl: syls[Math.floor(Math.random() * syls.length)],
    tone: (1 + Math.floor(Math.random() * 4)) as Tone,
  }));
}

function makeCardRound(cards: Card[]): Q[] {
  const usable = cards
    .map((card) => {
      const syl = parsePinyin(card.pinyin);
      const chars = card.hanzi.match(/\p{Script=Han}/gu) ?? [];
      return syl.length && syl.length === chars.length && syl.length <= 4
        ? { kind: 'card' as const, card, tones: syl.map((s) => s.tone), bases: syl.map((s) => s.base) }
        : null;
    })
    .filter((q): q is Extract<Q, { kind: 'card' }> => !!q);
  return shuffle(usable).slice(0, ROUND);
}

export function ToneQuiz() {
  const { cards, cloud } = useStore();
  const [source, setSource] = useState<'syl' | 'card'>('syl');
  const [round, setRound] = useState<Q[] | null>(null);
  const [i, setI] = useState(0);
  const [picks, setPicks] = useState<(Tone | null)[]>([]);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);

  const cardPool = useMemo(() => makeCardRound(cards), [cards]);
  const q = round?.[i];
  const slots = q ? (q.kind === 'syl' ? 1 : q.tones.length) : 0;
  const answer = q ? (q.kind === 'syl' ? [q.tone] : q.tones) : [];

  const play = useCallback(() => {
    if (!q) return;
    if (q.kind === 'syl') playSyllable(q.syl, q.tone, cloud);
    else speak(q.card);
  }, [q, cloud]);

  // Auto-play each new question.
  useEffect(() => {
    if (q) play();
  }, [i, round]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    const r = source === 'syl' ? makeSylRound() : makeCardRound(cards);
    if (!r.length) return;
    setRound(r);
    setI(0);
    setScore(0);
    setPicks(Array(r[0].kind === 'syl' ? 1 : (r[0] as Extract<Q, { kind: 'card' }>).tones.length).fill(null));
    setChecked(false);
  };

  const next = () => {
    if (!round) return;
    const n = i + 1;
    setI(n);
    setChecked(false);
    const nq = round[n];
    if (nq) setPicks(Array(nq.kind === 'syl' ? 1 : nq.tones.length).fill(null));
  };

  const check = (p: (Tone | null)[]) => {
    setChecked(true);
    if (p.every((t, k) => t === answer[k])) setScore((s) => s + 1);
  };

  const pick = (slot: number, t: Tone) => {
    if (checked) return;
    const p = picks.map((x, k) => (k === slot ? t : x));
    setPicks(p);
    if (slots === 1) check(p);
  };

  const allRight = checked && picks.every((t, k) => t === answer[k]);
  const toneChoices: Tone[] = q?.kind === 'card' ? [1, 2, 3, 4, 5] : [1, 2, 3, 4];

  return (
    <section className="panel quiz">
      <div className="row gap-s wrap">
        <h3 className="label">Tone quiz</h3>
        <span className="spacer" />
        {round && (
          <span className="mono small">
            {Math.min(i + 1, round.length)}/{round.length} · {score} right
          </span>
        )}
      </div>

      {!round || !q ? (
        <div className="quiz-start">
          {round && !q && (
            <motion.p className="quiz-result" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              {score}/{round.length} {score === round.length ? '完美！' : score >= round.length * 0.7 ? 'Nice ear!' : 'Keep listening!'}
            </motion.p>
          )}
          <Segmented
            value={source}
            onChange={setSource}
            options={[
              { value: 'syl', label: 'Single syllables' },
              { value: 'card', label: `My cards (${cardPool.length})` },
            ]}
          />
          <p className="muted small">
            {source === 'syl'
              ? 'Hear one syllable and pick its tone.'
              : 'Hear a word from your deck and mark the tone of each syllable.'}
          </p>
          <button className="btn primary" onClick={start} disabled={source === 'card' && !cardPool.length}>
            {round ? 'Play again' : 'Start quiz'}
          </button>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            className="quiz-q"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
          >
            <motion.button className="speak big" onClick={play} whileTap={{ scale: 0.9 }} aria-label="Play again">
              <Icon name="speaker" size={34} />
            </motion.button>

            {q.kind === 'card' && <p className="muted small">{checked ? `${q.card.hanzi} · ${q.card.pinyin} · ${q.card.meaning}` : q.card.meaning || ' '}</p>}

            {Array.from({ length: slots }, (_, slot) => {
              const right = answer[slot];
              const base = q.kind === 'syl' ? q.syl : q.bases[slot];
              return (
                <div key={slot} className="quiz-slot">
                  {slots > 1 && <span className="quiz-slot-label mono">{checked ? markTone(base, right) : `#${slot + 1}`}</span>}
                  <div className={`quiz-choices n${toneChoices.length}`}>
                    {toneChoices.map((t) => {
                      const chosen = picks[slot] === t;
                      const state = !checked ? (chosen ? 'chosen' : '') : t === right ? 'right' : chosen ? 'wrong' : 'dim';
                      return (
                        <motion.button
                          key={t}
                          className={`quiz-choice ${state}`}
                          onClick={() => pick(slot, t)}
                          whileTap={{ scale: 0.92 }}
                          animate={state === 'wrong' ? { x: [0, -6, 6, -3, 3, 0] } : state === 'right' ? { scale: [1, 1.08, 1] } : {}}
                          transition={{ duration: 0.35 }}
                          aria-label={t === 5 ? 'Neutral tone' : `Tone ${t}`}
                        >
                          <ToneContour tone={t} w={40} h={26} strokeWidth={3.5} />
                          <span>{t === 5 ? '·' : t}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {checked ? (
              <div className="row gap-s center">
                <span className={allRight ? 'quiz-verdict ok' : 'quiz-verdict bad'}>
                  {allRight ? 'Correct' : 'Not quite'}
                  {q.kind === 'syl' && ` · ${markTone(q.syl, q.tone)} ${PRACTICE[q.syl][q.tone - 1]}`}
                </span>
                <button className="btn primary" onClick={next} autoFocus>
                  Next
                </button>
              </div>
            ) : (
              slots > 1 && (
                <button className="btn primary" disabled={picks.some((p) => p === null)} onClick={() => check(picks)}>
                  Check
                </button>
              )
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </section>
  );
}
