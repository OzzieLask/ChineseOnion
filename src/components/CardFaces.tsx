import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Card, Face } from '../types';
import { speak } from '../lib/speech';
import { Icon } from './Icon';

export function SpeakButton({ card, big }: { card: Card; big?: boolean }) {
  return (
    <motion.button
      type="button"
      className={big ? 'speak big' : 'speak'}
      whileTap={{ scale: 0.88 }}
      onClick={(e) => {
        e.stopPropagation();
        speak(card);
      }}
      aria-label="Play pronunciation"
    >
      <Icon name="speaker" size={big ? 34 : 20} />
    </motion.button>
  );
}

/** Question side: only the faces chosen in study settings. */
export function FrontFaces({ card, faces }: { card: Card; faces: Face[] }) {
  return (
    <div className="faces front">
      {faces.includes('audio') && <SpeakButton card={card} big />}
      {faces.includes('hanzi') && <div className="hanzi xl">{card.hanzi}</div>}
      {faces.includes('pinyin') && <div className="pinyin lg">{card.pinyin}</div>}
      {faces.includes('meaning') && <div className="meaning lg">{card.meaning}</div>}
    </div>
  );
}

/** Answer side / detail view: everything on the card. */
export function FullFaces({ card, showPinyin }: { card: Card; showPinyin: boolean }) {
  const [peek, setPeek] = useState(false);
  const pinyinVisible = showPinyin || peek;
  return (
    <div className="faces full">
      <div className="row center gap-s">
        <div className="hanzi lg">{card.hanzi}</div>
        <SpeakButton card={card} />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {pinyinVisible ? (
          <motion.div key="py" className="pinyin" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {card.pinyin}
          </motion.div>
        ) : (
          <motion.button
            key="peek"
            type="button"
            className="btn ghost small"
            onClick={(e) => {
              e.stopPropagation();
              setPeek(true);
            }}
          >
            <Icon name="eye" size={14} /> pinyin
          </motion.button>
        )}
      </AnimatePresence>
      <div className="meaning">{card.meaning}</div>
      {card.image && <img className="card-img" src={card.image} alt="" />}
      {card.drawing && <img className="card-sketch" src={card.drawing} alt="Handwritten" />}
      {card.notes && <p className="notes">{card.notes}</p>}
      {card.tags.length > 0 && (
        <div className="chips center">
          {card.tags.map((t) => (
            <span key={t} className="chip static">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
