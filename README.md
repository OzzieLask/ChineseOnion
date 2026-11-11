# 白人Onion

A Chinese flashcard site: make cards, study them with Anki-style spaced repetition, learn the tones, and use it from any device.
Built with React, Vite, TypeScript and [Motion](https://motion.dev). Data lives in Supabase, and pronunciation comes from Azure neural TTS.

## Features

- **Cards**: character (type, paste, or **draw** with handwriting recognition), auto-filled pinyin, meaning, notes, tags, picture, a recording (record or upload), and a saved handwriting sketch.
- **Pronunciation**: cards without your own recording get a neural Mandarin voice (Azure *Xiaoxiao*). It's read from the card's **pinyin**, so you control tones and multi-reading characters (行 xíng / háng). Each clip is generated once when you save, then stored, so every device plays the same audio.
- **Study**: *Review due* (spaced repetition with Again/Hard/Good/Easy) or *Shuffle all* (practice without changing the schedule). Choose which faces show on the front. Tap to flip, swipe right for Good and left for Again, or use `space` and `1–4`.
- **Tones**: an animated pitch chart with playable mā má mǎ mà, how to produce each tone, tone-change (sandhi) rules with audio, and a **tone quiz** (single syllables, or words from your own deck).
- **Access**: anyone with the link can browse, study and quiz. Only you can edit, after unlocking with your PIN. Visitors' review progress stays in their own browser.
- **Export/Import JSON** in Settings.

## Run locally

```bash
npm install
npm run dev          # http://localhost:5179 (port is fixed: browser storage is tied to it)
```

With no `.env`, the app runs in **local mode**: cards are stored in that browser only, editing is always allowed, and pronunciation uses the device's voice.

---

## Deploy: one shared deck on every device

You'll need three free accounts: **Supabase** (database, storage, server function), **Azure** (voice), and **GitHub** (hosting).

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com). Pick the region closest to you.
2. **Authentication → Users → Add user → Create new user.** Any email works and it doesn't need to be real, e.g. `owner@onion.app`. Set the password to your **PIN (at least 6 characters)** and tick *Auto Confirm User*.
3. **Authentication → Sign In / Providers → turn off "Allow new users to sign up".**
4. **SQL Editor → New query:** paste [supabase/schema.sql](supabase/schema.sql), replace every `OWNER_EMAIL` with the email from step 2, and run it.
5. **Project Settings → API:** copy the *Project URL* and the *anon / publishable* key.

### 2. Azure Speech (pronunciation)

1. Create a free account at [portal.azure.com](https://portal.azure.com).
2. **Create a resource → Speech** (under *AI services*). Pricing tier **Free F0** includes 500,000 characters/month, far more than this app uses.
3. Open the resource → **Keys and Endpoint:** copy **Key 1** and the **Location/Region** (e.g. `eastus`).

### 3. Deploy the pronunciation function

From this folder (no install needed, `npx` downloads the Supabase CLI):

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>     # the id in your project URL
npx supabase secrets set AZURE_SPEECH_KEY=<key1> AZURE_SPEECH_REGION=<region> OWNER_EMAIL=<owner email>
npx supabase functions deploy tts
```

Optional: `AZURE_VOICE=zh-CN-YunxiNeural` for a male voice.

### 4. Point the site at Supabase

Locally: copy `.env.example` to `.env` and fill in:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_OWNER_EMAIL=owner@onion.app
```

The anon key is safe to publish. The database policies and the function enforce the lock, not the browser. The Azure key exists only inside Supabase.

### 5. GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Source: GitHub Actions.**
3. **Settings → Secrets and variables → Actions → Variables tab:** add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_OWNER_EMAIL`.
4. Push to `main`. [.github/workflows/deploy.yml](.github/workflows/deploy.yml) builds and publishes to `https://<you>.github.io/<repo>/`.

### 6. Move your existing cards

In local mode, go to **Settings → Export JSON**. Then open the deployed site, unlock with your PIN, **Import JSON** (recordings and pictures upload automatically), and press **Settings → Generate pronunciation**.

On your phone: open the site → *Add to Home Screen*.

---

## Notes

- Handwriting recognition uses Google's public Input Tools endpoint, so it needs a connection.
- Audio priority on a card: your recording → generated neural voice → the device's voice.
- Write pinyin with spaces between syllables (`nǐ hǎo`) so the neural voice gets exact tones. Without spaces, Azure decides the reading itself.
- Rename the app in [src/config.ts](src/config.ts) and [index.html](index.html).
