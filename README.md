# 白人Onion

A Chinese flashcard site: make cards, study them with Anki-style spaced repetition, and use it from your phone.
Built with React, Vite, TypeScript and [Motion](https://motion.dev).

## Features

- **Cards**: character (type, paste, or **draw** with handwriting recognition), auto-filled pinyin, meaning, notes, tags, picture, audio (record or upload), and a saved handwriting sketch.
- **Study**: *Review due* (spaced repetition with Again/Hard/Good/Easy) or *Shuffle all* (practice without changing the schedule). You pick which faces show on the front: character, pinyin, meaning and/or audio. Tap to flip, swipe right for Good and left for Again, or use keys `space` and `1–4`.
- **Pinyin toggle** in the study session and in Settings.
- **Tags**: filter the deck and study sessions by tag (food, numbers, duolingo…).
- **Export/Import JSON** in Settings.
- **Access**: everyone with the link can browse and study. Only you can edit, after unlocking with your PIN. Visitors' review progress stays in their own browser.

## Run locally

```bash
npm install
npm run dev
```

With no `.env`, the app runs in **local mode**: cards are stored in that browser (IndexedDB) and editing is always allowed.

## Shared deck with Supabase (free)

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Users → Add user → Create new user.** Use any email (it doesn't have to be real, e.g. `owner@onion.app`). Set the password to your **PIN (at least 6 characters)** and tick *Auto confirm user*.
3. **Authentication → Sign In / Providers → turn off "Allow new users to sign up".**
4. **SQL Editor:** paste [supabase/schema.sql](supabase/schema.sql), replace every `OWNER_EMAIL` with the email from step 2, and run it. This creates the `cards` table and the `media` storage bucket with row-level security: anyone can read, only the owner can write.
5. Copy `.env.example` to `.env` and fill in the values from **Project Settings → API**:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   VITE_OWNER_EMAIL=owner@onion.app
   ```
   The anon key is safe to publish. The database policies enforce the lock, not the browser.

To move cards from local mode to the cloud: Export in local mode, then Import after unlocking in cloud mode. Embedded audio and images are uploaded automatically.

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Source: GitHub Actions.**
3. **Settings → Secrets and variables → Actions → Variables:** add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_OWNER_EMAIL`.
4. Push to `main`. [.github/workflows/deploy.yml](.github/workflows/deploy.yml) builds and publishes the site.

On your phone, open the site and choose *Add to Home Screen* to get an app-like icon.

## Notes

- Handwriting recognition uses Google's public Input Tools endpoint, so it needs a connection. Offline, you can still keep the drawing as a sketch.
- Without a recorded audio clip, cards are read aloud by the browser's built-in Chinese voice.
- Rename the app in [src/config.ts](src/config.ts) and [index.html](index.html).
