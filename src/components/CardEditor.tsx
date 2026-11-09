import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Card } from '../types';
import { useStore } from '../store';
import { blankCard } from '../lib/cards';
import { toPinyin } from '../lib/pinyin';
import { renderSketches, type Sketch } from '../lib/handwriting';
import { shrinkImage } from '../lib/util';
import { AudioField, type Media } from './AudioField';
import { DrawPad } from './DrawPad';
import { TagInput } from './TagInput';
import { Icon } from './Icon';

interface Props {
  card: Card | null;
  onDone: () => void;
}

/** Create or edit a card. Pass card=null to create. */
export function CardEditor({ card, onDone }: Props) {
  const { saveCard, deleteCard, upload, allTags, toast } = useStore();
  const isNew = !card;
  const [base, setBase] = useState<Card>(() => card ?? blankCard());
  const [hanzi, setHanzi] = useState(base.hanzi);
  const [pinyin, setPinyin] = useState(base.pinyin);
  const [pinyinTouched, setPinyinTouched] = useState(!!card);
  const [meaning, setMeaning] = useState(base.meaning);
  const [notes, setNotes] = useState(base.notes);
  const [tags, setTags] = useState<string[]>(base.tags);
  const [audio, setAudio] = useState<Media>({ url: base.audio });
  const [image, setImage] = useState<Media>({ url: base.image });
  const [drawing, setDrawing] = useState<string | null>(base.drawing);
  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [sketchPreview, setSketchPreview] = useState<string | null>(null);
  const [showPad, setShowPad] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const hanziRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  // Auto pinyin until the user edits it by hand.
  useEffect(() => {
    if (!pinyinTouched) setPinyin(toPinyin(hanzi));
  }, [hanzi, pinyinTouched]);

  useEffect(() => {
    let url: string | null = null;
    renderSketches(sketches).then((b) => {
      url = b ? URL.createObjectURL(b) : null;
      setSketchPreview(url);
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [sketches]);

  const canSave = useMemo(() => !!(hanzi.trim() || meaning.trim()) && !saving, [hanzi, meaning, saving]);

  const reset = (keepTags: string[]) => {
    const fresh = blankCard();
    setBase(fresh);
    setHanzi('');
    setPinyin('');
    setPinyinTouched(false);
    setMeaning('');
    setNotes('');
    setTags(keepTags);
    setAudio({ url: null });
    setImage({ url: null });
    setDrawing(null);
    setSketches([]);
    hanziRef.current?.focus();
  };

  const save = async (another: boolean) => {
    if (!canSave) return;
    setSaving(true);
    try {
      const up = async (m: Media) => (m.blob ? upload(m.blob) : m.url);
      let drawingUrl = drawing;
      if (sketches.length) {
        const blob = await renderSketches(sketches);
        if (blob) drawingUrl = await upload(blob);
      }
      const next: Card = {
        ...base,
        hanzi: hanzi.trim(),
        pinyin: pinyin.trim(),
        meaning: meaning.trim(),
        notes: notes.trim(),
        tags,
        audio: await up(audio),
        image: await up(image),
        drawing: drawingUrl,
      };
      await saveCard(next);
      toast(isNew ? `Added ${next.hanzi || next.meaning}` : 'Saved');
      if (another) reset(tags);
      else onDone();
    } catch (e) {
      toast(`Save failed: ${(e as Error).message}`, 'err');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!card) return;
    if (!confirmDel) return setConfirmDel(true);
    try {
      await deleteCard(card.id);
      toast('Deleted');
      onDone();
    } catch (e) {
      toast(`Delete failed: ${(e as Error).message}`, 'err');
    }
  };

  return (
    <form
      className="editor"
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
    >
      <label className="field">
        <span className="label">Character</span>
        <div className="row gap-s">
          <input
            ref={hanziRef}
            className="input hanzi-input"
            value={hanzi}
            onChange={(e) => setHanzi(e.target.value)}
            placeholder="type, paste or draw"
            autoFocus={isNew}
            lang="zh"
          />
          <motion.button
            type="button"
            className={showPad ? 'btn icon-only active' : 'btn icon-only ghost'}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowPad((s) => !s)}
            aria-pressed={showPad}
            aria-label="Draw character"
          >
            <Icon name="pen" />
          </motion.button>
        </div>
      </label>

      <AnimatePresence initial={false}>
        {showPad && (
          <motion.div
            key="pad"
            className="collapse"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <DrawPad
              onPick={(ch, sk) => {
                if (ch) setHanzi((h) => h + ch);
                setSketches((s) => [...s, sk]);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {(sketchPreview || drawing) && (
        <div className="sketch-row">
          <img src={sketchPreview ?? drawing!} alt="Your handwriting" className="card-sketch small" />
          <button
            type="button"
            className="btn ghost small"
            onClick={() => {
              setSketches([]);
              setDrawing(null);
            }}
          >
            <Icon name="trash" size={14} /> Remove sketch
          </button>
        </div>
      )}

      <label className="field">
        <span className="label">
          Pinyin {!pinyinTouched && hanzi && <span className="muted">· auto</span>}
        </span>
        <input
          className="input"
          value={pinyin}
          onChange={(e) => {
            setPinyinTouched(true);
            setPinyin(e.target.value);
          }}
          placeholder="nǐ hǎo"
        />
      </label>

      <label className="field">
        <span className="label">Meaning</span>
        <textarea className="input" rows={2} value={meaning} onChange={(e) => setMeaning(e.target.value)} placeholder="hello" />
      </label>

      <div className="field">
        <span className="label">Tags</span>
        <TagInput value={tags} onChange={setTags} suggestions={allTags} />
      </div>

      <div className="field">
        <span className="label">Audio</span>
        <AudioField value={audio} onChange={setAudio} />
      </div>

      <div className="field">
        <span className="label">Picture</span>
        {image.url ? (
          <div className="row gap-s">
            <img src={image.url} alt="" className="thumb" />
            <button type="button" className="btn ghost small" onClick={() => setImage({ url: null })}>
              <Icon name="trash" size={14} /> Remove
            </button>
          </div>
        ) : (
          <button type="button" className="btn ghost small" onClick={() => imgRef.current?.click()}>
            <Icon name="image" size={16} /> Add picture
          </button>
        )}
        <input
          ref={imgRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const blob = await shrinkImage(f);
            setImage({ url: URL.createObjectURL(blob), blob });
            e.target.value = '';
          }}
        />
      </div>

      <label className="field">
        <span className="label">Notes</span>
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="example sentence, mnemonic…" />
      </label>

      <div className="editor-actions">
        {!isNew && (
          <motion.button type="button" className={confirmDel ? 'btn danger' : 'btn ghost'} onClick={remove} layout>
            <Icon name="trash" size={16} /> {confirmDel ? 'Really delete?' : 'Delete'}
          </motion.button>
        )}
        <span className="spacer" />
        {isNew && (
          <button type="button" className="btn ghost" disabled={!canSave} onClick={() => save(true)}>
            Save &amp; add another
          </button>
        )}
        <motion.button type="submit" className="btn primary" disabled={!canSave} whileTap={{ scale: 0.96 }}>
          {saving ? 'Saving…' : isNew ? 'Add card' : 'Save'}
        </motion.button>
      </div>
    </form>
  );
}
