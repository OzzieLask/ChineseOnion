import { get, set } from 'idb-keyval';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CLOUD, OWNER_EMAIL, SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';
import type { Card } from '../types';
import { blobToDataURL, extFor, uid } from './util';

/** Storage backend. Local = IndexedDB in this browser. Cloud = shared Supabase deck. */
export interface Repo {
  kind: 'local' | 'cloud';
  list(): Promise<Card[]>;
  save(cards: Card[]): Promise<void>;
  remove(ids: string[]): Promise<void>;
  /** Store a media blob and return a URL that can be put on a card. */
  upload(blob: Blob): Promise<string>;
  isOwner(): Promise<boolean>;
  unlock(pin: string): Promise<void>;
  lock(): Promise<void>;
  onOwnerChange(cb: (owner: boolean) => void): () => void;
}

const KEY = 'onion.cards';

/** Cards saved in this browser by local mode (still readable after switching to cloud). */
export async function readLocalCards(): Promise<Card[]> {
  try {
    return ((await get<Card[]>(KEY)) ?? []) as Card[];
  } catch {
    return [];
  }
}

function localRepo(): Repo {
  const all = async () => ((await get<Card[]>(KEY)) ?? []) as Card[];
  return {
    kind: 'local',
    list: all,
    async save(cards) {
      const map = new Map((await all()).map((c) => [c.id, c]));
      cards.forEach((c) => map.set(c.id, c));
      await set(KEY, [...map.values()]);
    },
    async remove(ids) {
      const drop = new Set(ids);
      await set(KEY, (await all()).filter((c) => !drop.has(c.id)));
    },
    upload: blobToDataURL,
    isOwner: async () => true,
    unlock: async () => {},
    lock: async () => {},
    onOwnerChange: () => () => {},
  };
}

/** Supabase client in cloud mode, null in local mode. */
export const sb: SupabaseClient | null = CLOUD ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/**
 * Pronunciation audio from the `tts` edge function (Azure neural voice).
 * Card audio needs the owner session; presets ("ma3") are public. Returns a cached mp3 URL.
 */
export async function fetchTts(body: { text: string; ph?: string | null } | { preset: string }): Promise<string> {
  if (!sb) throw new Error('Pronunciation service needs cloud mode');
  const { data, error } = await sb.functions.invoke<{ url?: string; error?: string }>('tts', { body });
  if (error) {
    // Surface the function's own error message when there is one.
    const ctx = (error as { context?: Response }).context;
    const detail = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
    throw new Error(detail?.error ?? error.message);
  }
  if (!data?.url) throw new Error(data?.error ?? 'No audio returned');
  return data.url;
}

const presetCache = new Map<string, Promise<string>>();
export function presetAudio(id: string): Promise<string> {
  let p = presetCache.get(id);
  if (!p) {
    p = fetchTts({ preset: id });
    p.catch(() => presetCache.delete(id));
    presetCache.set(id, p);
  }
  return p;
}

function cloudRepo(sb: SupabaseClient): Repo {
  const isOwnerEmail = (email?: string | null) => !!email && email.toLowerCase() === OWNER_EMAIL.toLowerCase();
  return {
    kind: 'cloud',
    async list() {
      const out: Card[] = [];
      const page = 1000;
      for (let from = 0; ; from += page) {
        const { data, error } = await sb.from('cards').select('data').range(from, from + page - 1);
        if (error) throw error;
        out.push(...data.map((r) => r.data as Card));
        if (data.length < page) break;
      }
      return out;
    },
    async save(cards) {
      if (!cards.length) return;
      const rows = cards.map((c) => ({ id: c.id, data: c, updated_at: new Date(c.updatedAt).toISOString() }));
      const { error } = await sb.from('cards').upsert(rows);
      if (error) throw error;
    },
    async remove(ids) {
      if (!ids.length) return;
      const { error } = await sb.from('cards').delete().in('id', ids);
      if (error) throw error;
    },
    async upload(blob) {
      const path = `${uid()}.${extFor(blob.type)}`;
      const { error } = await sb.storage.from('media').upload(path, blob, { contentType: blob.type || undefined });
      if (error) throw error;
      return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
    },
    async isOwner() {
      const { data } = await sb.auth.getSession();
      return isOwnerEmail(data.session?.user.email);
    },
    async unlock(pin) {
      const { data, error } = await sb.auth.signInWithPassword({ email: OWNER_EMAIL, password: pin });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong PIN' : error.message);
      if (!isOwnerEmail(data.user?.email)) throw new Error('Not the owner account');
    },
    async lock() {
      await sb.auth.signOut();
    },
    onOwnerChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) => cb(isOwnerEmail(session?.user.email)));
      return () => data.subscription.unsubscribe();
    },
  };
}

export const repo: Repo = sb ? cloudRepo(sb) : localRepo();
