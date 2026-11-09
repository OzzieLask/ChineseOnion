import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Card, Prefs, SrsState } from './types';
import { repo } from './lib/repo';
import { newSrs, schedule, type Grade } from './lib/srs';
import { dataURLToBlob } from './lib/util';

const PREFS_KEY = 'onion.prefs';
const PROGRESS_KEY = 'onion.progress';

const defaultPrefs: Prefs = { showPinyin: true, front: ['hanzi'], studyTags: [], studyMode: 'review' };

function readLS<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? { ...fallback, ...JSON.parse(v) } : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: prefs just won't persist */
  }
}

export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'err';
}

interface Store {
  cards: Card[];
  loading: boolean;
  loadError: string | null;
  /** True when this viewer may edit (always true in local mode). */
  owner: boolean;
  cloud: boolean;
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  allTags: string[];
  srsOf: (c: Card) => SrsState;
  saveCard: (c: Card) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  grade: (c: Card, g: Grade) => SrsState;
  upload: (b: Blob) => Promise<string>;
  importCards: (cards: Card[], mode: 'merge' | 'replace') => Promise<number>;
  unlock: (pin: string) => Promise<void>;
  lock: () => Promise<void>;
  reload: () => Promise<void>;
  toasts: Toast[];
  toast: (text: string, tone?: Toast['tone']) => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [owner, setOwner] = useState(repo.kind === 'local');
  const [prefs, setPrefsState] = useState<Prefs>(() => readLS(PREFS_KEY, defaultPrefs));
  const [progress, setProgress] = useState<Record<string, SrsState>>(() => readLS(PROGRESS_KEY, {}));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setCards(await repo.list());
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    repo.isOwner().then(setOwner);
    return repo.onOwnerChange(setOwner);
  }, [reload]);

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...p };
      writeLS(PREFS_KEY, next);
      return next;
    });
  }, []);

  const srsOf = useCallback(
    (c: Card) => (owner ? c.srs : progress[c.id] ?? newSrs(c.createdAt)),
    [owner, progress],
  );

  const saveCard = useCallback(
    async (c: Card) => {
      const card = { ...c, updatedAt: Date.now() };
      await repo.save([card]);
      setCards((cs) => {
        const i = cs.findIndex((x) => x.id === card.id);
        return i < 0 ? [...cs, card] : cs.map((x) => (x.id === card.id ? card : x));
      });
    },
    [],
  );

  const deleteCard = useCallback(async (id: string) => {
    await repo.remove([id]);
    setCards((cs) => cs.filter((c) => c.id !== id));
  }, []);

  const grade = useCallback(
    (c: Card, g: Grade) => {
      const next = schedule(srsOf(c), g);
      if (owner) {
        const card = { ...c, srs: next };
        setCards((cs) => cs.map((x) => (x.id === c.id ? card : x)));
        repo.save([card]).catch((e) => toast(`Couldn't save progress: ${e.message ?? e}`, 'err'));
      } else {
        setProgress((p) => {
          const np = { ...p, [c.id]: next };
          writeLS(PROGRESS_KEY, np);
          return np;
        });
      }
      return next;
    },
    [owner, srsOf, toast],
  );

  const upload = useCallback((b: Blob) => repo.upload(b), []);

  const importCards = useCallback(
    async (incoming: Card[], mode: 'merge' | 'replace') => {
      // In cloud mode, embedded data: URLs (e.g. from a local-mode export) get uploaded to storage.
      const prepared: Card[] = [];
      for (const c of incoming) {
        const card = { ...c };
        if (repo.kind === 'cloud') {
          for (const k of ['audio', 'image', 'drawing'] as const) {
            const v = card[k];
            if (v?.startsWith('data:')) card[k] = await repo.upload(await dataURLToBlob(v));
          }
        }
        prepared.push(card);
      }
      const current = new Map(cards.map((c) => [c.id, c]));
      const toSave = prepared.filter((c) => {
        const ex = current.get(c.id);
        return mode === 'replace' || !ex || c.updatedAt >= ex.updatedAt;
      });
      await repo.save(toSave);
      if (mode === 'replace') {
        const keep = new Set(prepared.map((c) => c.id));
        await repo.remove(cards.filter((c) => !keep.has(c.id)).map((c) => c.id));
      }
      await reload();
      return toSave.length;
    },
    [cards, reload],
  );

  const unlock = useCallback(async (pin: string) => {
    await repo.unlock(pin);
    setOwner(true);
  }, []);
  const lock = useCallback(async () => {
    await repo.lock();
    setOwner(false);
  }, []);

  const allTags = useMemo(
    () => [...new Set(cards.flatMap((c) => c.tags))].sort((a, b) => a.localeCompare(b)),
    [cards],
  );

  const value: Store = {
    cards,
    loading,
    loadError,
    owner,
    cloud: repo.kind === 'cloud',
    prefs,
    setPrefs,
    allTags,
    srsOf,
    saveCard,
    deleteCard,
    grade,
    upload,
    importCards,
    unlock,
    lock,
    reload,
    toasts,
    toast,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
