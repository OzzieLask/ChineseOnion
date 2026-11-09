/** Rename the app here. */
export const APP_NAME = '白人Onion';
export const APP_TAGLINE = 'flashcards, layer by layer';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const OWNER_EMAIL = import.meta.env.VITE_OWNER_EMAIL || '';

/** Cloud mode = shared deck on Supabase. Otherwise everything lives in this browser. */
export const CLOUD = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && OWNER_EMAIL);
