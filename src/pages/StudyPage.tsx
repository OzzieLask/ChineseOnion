import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import type { Card, Face } from '../types';
import { FACES } from '../types';
import { useStore } from '../store';
import { GRADES, formatSpan, isDue, schedule, type Grade } from '../lib/srs';
import { speak } from '../lib/speech';
import { shuffle } from '../lib/util';
import { FrontFaces, FullFaces } from '../components/CardFaces';
import { Icon } from '../components/Icon';

const REQUEUE_MS = 20 * 60_000;

export function StudyPage({ goCards }: { goCards: () => void }) {
  const { cards, prefs, setPrefs, srsOf, allTags } = useStore();
  const [session, setSession] = useState<null | { queue: string[]; total: number; mode: 'review' | 'shuffle' }>(null);

  const pool = useMemo(
    () => (prefs.studyTags.length ? cards.filter((c) => c.tags.some((t) => prefs.studyTags.includes(t))) : cards),
    [cards, prefs.studyTags],
  );
  const now = Date.now();
  const due = pool.filter((c) => isDue(srsOf(c), now));
  const newCount = due.filter((c) => !srsOf(c).last).length;
  const count = prefs.studyMode === 'review' ? due.length : pool.length;

  const start = () => {
    const list = prefs.studyMode === 'review' ? due : pool;
    const ids = shuffle(list).map((c) => c.id);
    setSession({ queue: ids, total: ids.length, mode: prefs.studyMode });
  };

  if (session) {
    return <Session key={session.total + session.mode} {...session} onExit={() => setSession(null)} onAgain={start} />;
  }

  const toggleTag = (t: string) =>
    setPrefs({ studyTags: prefs.studyTags.includes(t) ? prefs.studyTags.filter((x) => x !== t) : [...prefs.studyTags, t] });
  const toggleFace = (f: Face) => {
    const next = prefs.front.includes(f) ? prefs.front.filter((x) => x !== f) : [...prefs.front, f];
    if (next.length) setPrefs({ front: next });
  };

  return (
    <div className="page study-setup">
      <section className="hero">
        <motion.div className="big-count" key={count} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          {count}
        </motion.div>
        <p className="muted">
          {prefs.studyMode === 'review'
            ? count
              ? `card${count === 1 ? '' : 's'} to review${newCount ? ` · ${newCount} new` : ''}`
              : 'nothing due right now'
            : `card${count === 1 ? '' : 's'} to shuffle through`}
        </p>
      </section>

      <section className="panel">
        <h3 className="label">Mode</h3>
        <Segmented
          value={prefs.studyMode}
          onChange={(v) => setPrefs({ studyMode: v })}
          options={[
            { value: 'review', label: 'Review due', icon: 'study' },
            { value: 'shuffle', label: 'Shuffle all', icon: 'shuffle' },
          ]}
        />
        <p className="muted small">
          {prefs.studyMode === 'review'
            ? 'Spaced repetition: rate each card and it comes back when you are about to forget it.'
            : 'Practice everything in random order. Does not change your schedule.'}
        </p>
      </section>

      <section className="panel">
        <h3 className="label">Front of card shows</h3>
        <div className="chips">
          {FACES.map((f) => (
            <motion.button
              key={f.id}
              type="button"
              className={prefs.front.includes(f.id) ? 'chip on' : 'chip'}
              whileTap={{ scale: 0.93 }}
              onClick={() => toggleFace(f.id)}
              aria-pressed={prefs.front.includes(f.id)}
            >
              {f.label}
            </motion.button>
          ))}
        </div>
      </section>

      {allTags.length > 0 && (
        <section className="panel">
          <h3 className="label">Tags {prefs.studyTags.length > 0 && <button className="link" onClick={() => setPrefs({ studyTags: [] })}>clear</button>}</h3>
          <div className="chips">
            {allTags.map((t) => (
              <motion.button
                key={t}
                type="button"
                className={prefs.studyTags.includes(t) ? 'chip on' : 'chip'}
                whileTap={{ scale: 0.93 }}
                onClick={() => toggleTag(t)}
              >
                {t}
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {cards.length === 0 ? (
        <button className="btn primary wide" onClick={goCards}>
          <Icon name="plus" /> Make your first cards
        </button>
      ) : (
        <motion.button className="btn primary wide" disabled={!count} onClick={start} whileTap={{ scale: 0.97 }} whileHover={{ y: -2 }}>
          Start {count ? `· ${count}` : ''}
        </motion.button>
      )}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: string }[];
}) {
  const pillId = useId();
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
          {value === o.value && <motion.span layoutId={pillId} className="seg-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="seg-label">
            {o.icon && <Icon name={o.icon} size={16} />} {o.label}
          </span>
        </button>
      ))}
    </div>
  );
}

function Session({
  queue: initial,
  total,
  mode,
  onExit,
  onAgain,
}: {
  queue: string[];
  total: number;
  mode: 'review' | 'shuffle';
  onExit: () => void;
  onAgain: () => void;
}) {
  const { cards, prefs, setPrefs, grade, srsOf } = useStore();
  const [queue, setQueue] = useState(initial);
  const [flipped, setFlipped] = useState(false);
  const [turn, setTurn] = useState(0);
  const [dir, setDir] = useState(1);
  const [done, setDone] = useState(0);
  const [tally, setTally] = useState({ again: 0, ok: 0 });

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const card = queue.length ? byId.get(queue[0]) : undefined;

  // Skip ids whose card was deleted mid-session.
  useEffect(() => {
    if (queue.length && !card) setQueue((q) => q.slice(1));
  }, [queue, card]);

  // Auto-play when audio is on the front.
  useEffect(() => {
    if (card && prefs.front.includes('audio')) speak(card);
  }, [turn, card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = useCallback(
    (g: Grade) => {
      if (!card) return;
      let again = g === 0;
      if (mode === 'review') {
        const next = grade(card, g);
        again = next.due - Date.now() < REQUEUE_MS;
      }
      setTally((t) => (g === 0 ? { ...t, again: t.again + 1 } : { ...t, ok: t.ok + 1 }));
      setDir(g === 0 ? -1 : 1);
      setQueue((q) => {
        const rest = q.slice(1);
        if (again) rest.splice(Math.min(rest.length, 3 + Math.floor(Math.random() * 3)), 0, q[0]);
        return rest;
      });
      if (!again) setDone((d) => d + 1);
      setFlipped(false);
      setTurn((t) => t + 1);
    },
    [card, mode, grade],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
        const g = (Number(e.key) - 1) as Grade;
        if (mode === 'review' || g === 0 || g === 2) answer(g);
      } else if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flipped, answer, mode, onExit]);

  const grades = mode === 'review' ? GRADES : [GRADES[0], { ...GRADES[2], label: 'Got it' }];

  return (
    <div className="page session">
      <div className="session-top">
        <button className="icon-btn" onClick={onExit} aria-label="End session">
          <Icon name="x" />
        </button>
        <div className="progress" aria-label={`${done} of ${total} done`}>
          <motion.div className="progress-fill" animate={{ width: `${total ? (done / total) * 100 : 100}%` }} transition={{ type: 'spring', stiffness: 200, damping: 30 }} />
        </div>
        <span className="mono small">
          {done}/{total}
        </span>
        <button
          className={prefs.showPinyin ? 'icon-btn on' : 'icon-btn'}
          onClick={() => setPrefs({ showPinyin: !prefs.showPinyin })}
          aria-label={prefs.showPinyin ? 'Hide pinyin' : 'Show pinyin'}
          title="Toggle pinyin"
        >
          <Icon name={prefs.showPinyin ? 'eye' : 'eyeOff'} />
        </button>
      </div>

      <div className="stage">
        <AnimatePresence mode="popLayout" custom={dir}>
          {card ? (
            <StudyCard
              key={`${card.id}-${turn}`}
              card={card}
              front={prefs.front}
              showPinyin={prefs.showPinyin}
              flipped={flipped}
              onFlip={() => setFlipped((f) => !f)}
              onSwipe={(g) => answer(g)}
              dir={dir}
            />
          ) : (
            <motion.div key="done" className="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
              <motion.div className="done-onion" animate={{ rotate: [0, -10, 10, -6, 0], y: [0, -12, 0] }} transition={{ duration: 1, delay: 0.2 }}>
                <img src="./onion.svg" alt="" width={84} height={84} />
              </motion.div>
              <h2>All peeled!</h2>
              <p className="muted">
                {total} card{total === 1 ? '' : 's'} · {tally.again} miss{tally.again === 1 ? '' : 'es'}
              </p>
              <div className="row gap-s center">
                <button className="btn ghost" onClick={onExit}>
                  Done
                </button>
                <button className="btn primary" onClick={onAgain}>
                  Go again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {card && (
        <div className="answer-bar">
          <AnimatePresence mode="wait" initial={false}>
            {!flipped ? (
              <motion.button
                key="show"
                className="btn primary wide"
                onClick={() => setFlipped(true)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.15 }}
              >
                Show answer <kbd>space</kbd>
              </motion.button>
            ) : (
              <motion.div
                key="grades"
                className={`grades n${grades.length}`}
                initial="hide"
                animate="show"
                exit="hide"
                variants={{ show: { transition: { staggerChildren: 0.035 } }, hide: {} }}
              >
                {grades.map((gr) => (
                  <motion.button
                    key={gr.g}
                    className={`grade g${gr.g}`}
                    onClick={() => answer(gr.g)}
                    variants={{ hide: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                    whileTap={{ scale: 0.94 }}
                  >
                    <span>{gr.label}</span>
                    {mode === 'review' && <small>{formatSpan(schedule(srsOf(card), gr.g).due - Date.now())}</small>}
                    <kbd>{gr.key}</kbd>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

const SWIPE = 110;

function StudyCard({
  card,
  front,
  showPinyin,
  flipped,
  onFlip,
  onSwipe,
  dir,
}: {
  card: Card;
  front: Face[];
  showPinyin: boolean;
  flipped: boolean;
  onFlip: () => void;
  onSwipe: (g: Grade) => void;
  dir: number;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-12, 12]);
  const goodOpacity = useTransform(x, [20, SWIPE], [0, 1]);
  const againOpacity = useTransform(x, [-SWIPE, -20], [1, 0]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE || info.velocity.x > 600) onSwipe(2);
    else if (info.offset.x < -SWIPE || info.velocity.x < -600) onSwipe(0);
  };

  return (
    <motion.div
      className="card-shell"
      style={{ x, rotate }}
      custom={dir}
      variants={{
        enter: { opacity: 0, y: 30, scale: 0.94 },
        center: { opacity: 1, y: 0, scale: 1 },
        exit: (d: number) => ({ opacity: 0, x: d * 360, rotate: d * 14, transition: { duration: 0.28 } }),
      }}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      drag={flipped ? 'x' : false}
      dragSnapToOrigin
      dragElastic={0.7}
      onDragEnd={onDragEnd}
    >
      <motion.div
        className="flip"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        onClick={onFlip}
      >
        <div className="face face-front">
          <FrontFaces card={card} faces={front} />
          <span className="tap-hint">tap to flip</span>
        </div>
        <div className="face face-back">
          <FullFaces card={card} showPinyin={showPinyin} />
        </div>
      </motion.div>
      {flipped && (
        <>
          <motion.span className="swipe-badge good" style={{ opacity: goodOpacity }}>
            Good
          </motion.span>
          <motion.span className="swipe-badge again" style={{ opacity: againOpacity }}>
            Again
          </motion.span>
        </>
      )}
    </motion.div>
  );
}
