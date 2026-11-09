import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from './Icon';

export function TagInput({ value, onChange, suggestions }: { value: string[]; onChange: (t: string[]) => void; suggestions: string[] }) {
  const [text, setText] = useState('');
  const add = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (t && !value.includes(t)) onChange([...value, t]);
    setText('');
  };
  const unused = suggestions.filter((s) => !value.includes(s));
  const filtered = text ? unused.filter((s) => s.includes(text.toLowerCase())) : unused;

  return (
    <div className="tags-input">
      <div className="chips">
        <AnimatePresence initial={false}>
          {value.map((t) => (
            <motion.button
              layout
              key={t}
              type="button"
              className="chip on"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => onChange(value.filter((x) => x !== t))}
              aria-label={`Remove tag ${t}`}
            >
              {t} <Icon name="x" size={12} />
            </motion.button>
          ))}
        </AnimatePresence>
        <input
          className="chip-input"
          value={text}
          placeholder={value.length ? 'add tag' : 'food, numbers, duolingo…'}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(',')) add(v.slice(0, -1));
            else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(text);
            } else if (e.key === 'Backspace' && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => text && add(text)}
        />
      </div>
      {filtered.length > 0 && (
        <div className="chips suggest">
          {filtered.slice(0, 10).map((s) => (
            <button key={s} type="button" className="chip" onMouseDown={(e) => e.preventDefault()} onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
