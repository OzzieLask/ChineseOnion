import { useEffect, useRef, useState } from 'react';
import { readLocalCards } from '../lib/repo';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../store';
import { needsTts, normalizeCard } from '../lib/cards';
import { download } from '../lib/util';
import { APP_NAME } from '../config';
import type { Card } from '../types';
import { Icon } from '../components/Icon';
import { Segmented } from './StudyPage';

export function SettingsPage() {
  const { prefs, setPrefs, cards, owner, cloud, unlock, lock, importCards, toast, generateAllTts } = useStore();
  const [ttsBusy, setTtsBusy] = useState<[number, number] | null>(null);
  const missing = cards.filter(needsTts).length;
  const generateAll = async () => {
    setTtsBusy([0, missing]);
    try {
      const n = await generateAllTts((d, t) => setTtsBusy([d, t]));
      toast(`Generated pronunciation for ${n} card${n === 1 ? '' : 's'}`);
    } catch (e) {
      toast(`Pronunciation failed: ${(e as Error).message}`, 'err');
    } finally {
      setTtsBusy(null);
    }
  };
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [pinErr, setPinErr] = useState<string | null>(null);
  const [pending, setPending] = useState<Card[] | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const fileRef = useRef<HTMLInputElement>(null);

  // Cards left in this browser from local mode that aren't in the shared deck yet.
  const [localOnly, setLocalOnly] = useState<Card[]>([]);
  useEffect(() => {
    if (!cloud) return;
    readLocalCards().then((list) => {
      const have = new Set(cards.map((c) => c.id));
      setLocalOnly(list.map(normalizeCard).filter((c): c is Card => !!c && !have.has(c.id)));
    });
  }, [cloud, cards]);

  const doUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setPinErr(null);
    try {
      await unlock(pin);
      setPin('');
      toast('Unlocked. You can edit now.');
    } catch (err) {
      setPinErr((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    download(
      `onion-cards-${stamp}.json`,
      JSON.stringify({ app: 'chinese-onion', version: 1, exportedAt: new Date().toISOString(), cards }, null, 2),
    );
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    try {
      const json = JSON.parse(await f.text());
      const raw: unknown[] = Array.isArray(json) ? json : Array.isArray(json?.cards) ? json.cards : [];
      const list = raw.map(normalizeCard).filter((c): c is Card => !!c);
      if (!list.length) throw new Error('No cards found in that file');
      setPending(list);
    } catch (e) {
      toast(`Import failed: ${(e as Error).message}`, 'err');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const confirmImport = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const n = await importCards(pending, importMode);
      toast(`Imported ${n} card${n === 1 ? '' : 's'}`);
      setPending(null);
    } catch (e) {
      toast(`Import failed: ${(e as Error).message}`, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page settings">
      <section className="panel">
        <h3 className="label">Display</h3>
        <label className="toggle-row">
          <span>Show pinyin</span>
          <Switch on={prefs.showPinyin} onChange={(v) => setPrefs({ showPinyin: v })} />
        </label>
      </section>

      <section className="panel">
        <h3 className="label">Editing</h3>
        {!cloud ? (
          <p className="muted small">
            <strong>Local mode.</strong> Cards are saved in this browser only. Connect Supabase (see README) to share one deck
            between your phone, laptop and portfolio visitors.
          </p>
        ) : owner ? (
          <div className="row gap-s">
            <span className="badge ok">
              <Icon name="unlock" size={14} /> Unlocked
            </span>
            <span className="spacer" />
            <button className="btn ghost" onClick={() => lock().then(() => toast('Locked'))}>
              <Icon name="lock" size={16} /> Lock
            </button>
          </div>
        ) : (
          <form className="pin-form" onSubmit={doUnlock}>
            <p className="muted small">Visitors can browse and study. Your progress is kept in this browser. Enter the PIN to edit.</p>
            <motion.div className="row gap-s" animate={pinErr ? { x: [0, -8, 8, -5, 5, 0] } : {}} transition={{ duration: 0.35 }} key={pinErr ?? 'ok'}>
              <input
                className="input pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                placeholder="PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
              <button className="btn primary" disabled={!pin || busy}>
                <Icon name="unlock" size={16} /> Unlock
              </button>
            </motion.div>
            {pinErr && <p className="error small">{pinErr}</p>}
          </form>
        )}
      </section>

      <section className="panel">
        <h3 className="label">Pronunciation</h3>
        {!cloud ? (
          <p className="muted small">
            Using your device’s built-in voice. Once Supabase and Azure are connected, every card gets a neural Mandarin
            recording automatically, read from its pinyin so tones are exact.
          </p>
        ) : (
          <>
            <p className="muted small">
              Cards without your own recording get a neural Mandarin voice (Azure), read from the card’s pinyin. It’s made
              when you save a card and stored, so every device plays the same clip.
            </p>
            {owner && (
              <div className="row gap-s wrap">
                <button className="btn ghost" disabled={!missing || ttsBusy !== null} onClick={generateAll}>
                  <Icon name="speaker" size={16} />
                  {ttsBusy ? `Generating ${ttsBusy[0]}/${ttsBusy[1]}…` : missing ? `Generate for ${missing} card${missing === 1 ? '' : 's'}` : 'All cards have audio'}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <section className="panel">
        <h3 className="label">Data</h3>
        {owner && localOnly.length > 0 && !pending && (
          <div className="row gap-s wrap local-migrate">
            <span className="small">
              <strong>{localOnly.length}</strong> card{localOnly.length === 1 ? '' : 's'} saved in this browser {localOnly.length === 1 ? "isn't" : "aren't"} in the shared deck yet.
            </span>
            <button className="btn primary small" onClick={() => (setImportMode('merge'), setPending(localOnly))}>
              <Icon name="upload" size={14} /> Copy to shared deck
            </button>
          </div>
        )}
        <div className="row gap-s wrap">
          <button className="btn ghost" onClick={doExport} disabled={!cards.length}>
            <Icon name="download" size={16} /> Export JSON ({cards.length})
          </button>
          {owner && (
            <button className="btn ghost" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={16} /> Import JSON
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <AnimatePresence>
          {pending && (
            <motion.div className="import-confirm" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <p>
                Found <strong>{pending.length}</strong> cards.
              </p>
              <Segmented
                value={importMode}
                onChange={setImportMode}
                options={[
                  { value: 'merge', label: 'Merge' },
                  { value: 'replace', label: 'Replace all' },
                ]}
              />
              <p className="muted small">
                {importMode === 'merge'
                  ? 'Adds new cards and updates ones with the same id if the file is newer.'
                  : `Deletes cards not in the file. ${cards.length} → ${pending.length}.`}
              </p>
              <div className="row gap-s">
                <button className="btn ghost" onClick={() => setPending(null)}>
                  Cancel
                </button>
                <button className={importMode === 'replace' ? 'btn danger' : 'btn primary'} onClick={confirmImport} disabled={busy}>
                  {busy ? 'Importing…' : 'Import'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <p className="muted small">
          Format: <code>{'{ "cards": [{ "hanzi", "pinyin", "meaning", "tags": [] }] }'}</code>. Missing pinyin is filled in automatically.
        </p>
      </section>

      <p className="muted small center-text">{APP_NAME} · {cloud ? 'shared deck' : 'local deck'}</p>
    </div>
  );
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={on ? 'switch on' : 'switch'} onClick={() => onChange(!on)}>
      <motion.span className="knob" layout transition={{ type: 'spring', stiffness: 600, damping: 34 }} />
    </button>
  );
}
