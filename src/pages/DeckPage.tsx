import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Card } from '../types';
import { useStore } from '../store';
import { COMFORT_LABEL, comfort, formatSpan } from '../lib/srs';
import { plain } from '../lib/util';
import { sampleCards } from '../lib/cards';
import { speak } from '../lib/speech';
import { Modal } from '../components/Modal';
import { CardEditor } from '../components/CardEditor';
import { FullFaces } from '../components/CardFaces';
import { Icon } from '../components/Icon';

type Sort = 'new' | 'old' | 'due' | 'weak' | 'az';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'new', label: 'Newest' },
  { id: 'old', label: 'Oldest' },
  { id: 'due', label: 'Due soonest' },
  { id: 'weak', label: 'Least comfortable' },
  { id: 'az', label: 'Pinyin A–Z' },
];

export function DeckPage() {
  const { cards, owner, allTags, srsOf, prefs, saveCard, loading, toast } = useStore();
  const [q, setQ] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>('new');
  const [editing, setEditing] = useState<Card | 'new' | null>(null);
  const [viewing, setViewing] = useState<Card | null>(null);

  const shown = useMemo(() => {
    const needle = plain(q);
    let list = cards.filter((c) => {
      if (tags.length && !c.tags.some((t) => tags.includes(t))) return false;
      if (!needle) return true;
      return [c.hanzi, c.pinyin, c.meaning, c.notes, c.tags.join(' ')].some((f) => plain(f).includes(needle));
    });
    const by: Record<Sort, (a: Card, b: Card) => number> = {
      new: (a, b) => b.createdAt - a.createdAt,
      old: (a, b) => a.createdAt - b.createdAt,
      due: (a, b) => srsOf(a).due - srsOf(b).due,
      weak: (a, b) => srsOf(a).interval - srsOf(b).interval || srsOf(b).lapses - srsOf(a).lapses,
      az: (a, b) => plain(a.pinyin).localeCompare(plain(b.pinyin)),
    };
    list = list.slice().sort(by[sort]);
    return list;
  }, [cards, q, tags, sort, srsOf]);

  const open = (c: Card) => (owner ? setEditing(c) : setViewing(c));

  const loadSamples = async () => {
    for (const c of sampleCards()) await saveCard(c);
    toast('Added 8 sample cards');
  };

  return (
    <div className="page deck">
      <div className="deck-head">
        <div className="search">
          <Icon name="search" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 字, pinyin, meaning…" aria-label="Search cards" />
          {q && (
            <button className="icon-btn tiny" onClick={() => setQ('')} aria-label="Clear search">
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        {owner && (
          <motion.button className="btn primary hide-mobile" onClick={() => setEditing('new')} whileTap={{ scale: 0.95 }}>
            <Icon name="plus" size={18} /> New card
          </motion.button>
        )}
      </div>

      {allTags.length > 0 && (
        <div className="chips scroll-x">
          <button className={tags.length ? 'chip' : 'chip on'} onClick={() => setTags([])}>
            All · {cards.length}
          </button>
          {allTags.map((t) => (
            <motion.button
              key={t}
              whileTap={{ scale: 0.93 }}
              className={tags.includes(t) ? 'chip on' : 'chip'}
              onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}
            >
              {t}
            </motion.button>
          ))}
        </div>
      )}

      {!loading && cards.length === 0 && (
        <motion.div className="empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <img src="./onion.svg" width={72} height={72} alt="" />
          <h2>No cards yet</h2>
          {owner ? (
            <>
              <p className="muted">Add your first word, or start with a few samples.</p>
              <div className="row gap-s center">
                <button className="btn ghost" onClick={loadSamples}>
                  <Icon name="sparkle" size={16} /> Load samples
                </button>
                <button className="btn primary" onClick={() => setEditing('new')}>
                  <Icon name="plus" size={16} /> New card
                </button>
              </div>
            </>
          ) : (
            <p className="muted">Nothing here yet.</p>
          )}
        </motion.div>
      )}

      <motion.ul className="grid" layout>
        <AnimatePresence initial={false}>
          {shown.map((c) => {
            const s = srsOf(c);
            const level = comfort(s);
            const dueIn = s.due - Date.now();
            return (
              <motion.li
                key={c.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              >
                <motion.button className="tile" onClick={() => open(c)} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}>
                  <span className={`dot ${level}`} title={`${COMFORT_LABEL[level]}${level !== 'new' ? ` · due ${dueIn <= 0 ? 'now' : 'in ' + formatSpan(dueIn)}` : ''}`} />
                  <span className="tile-hanzi">{c.hanzi || '—'}</span>
                  {prefs.showPinyin && <span className="tile-pinyin">{c.pinyin}</span>}
                  <span className="tile-meaning">{c.meaning}</span>
                  <span className="tile-icons">
                    {c.image && <Icon name="image" size={14} />}
                    {c.drawing && <Icon name="pen" size={14} />}
                  </span>
                </motion.button>
                <button
                  className="tile-speak"
                  onClick={() => speak(c)}
                  aria-label={`Play ${c.hanzi}`}
                  title={c.audio ? 'Play recording' : 'Play (browser voice)'}
                >
                  <Icon name="speaker" size={16} />
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ul>

      {cards.length > 0 && shown.length === 0 && <p className="muted center-text">No cards match.</p>}

      {owner && (
        <motion.button
          className="fab show-mobile"
          onClick={() => setEditing('new')}
          aria-label="New card"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Icon name="plus" size={26} />
        </motion.button>
      )}

      <AnimatePresence>
        {editing && (
          <Modal key="edit" title={editing === 'new' ? 'New card' : 'Edit card'} onClose={() => setEditing(null)}>
            <CardEditor card={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
          </Modal>
        )}
        {viewing && (
          <Modal key="view" title={viewing.hanzi || 'Card'} onClose={() => setViewing(null)}>
            <FullFaces card={viewing} showPinyin={prefs.showPinyin} />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
