# RhythmTap

**RhythmTap** is a fast, mobile-first three-lane rhythm game for the web. Play songs across Easy, Normal, and Hard difficulties, build combos, earn XP, level up your profile, unlock content, compete in real-time multiplayer score battles, and showcase your progress to other players online.

**Play:** https://jonnyt123.github.io/Rhythtap/

## Features

- Three-lane rhythm gameplay designed for desktop and mobile
- Circular tap notes and hold notes
- Easy, Normal, and Hard difficulty charts
- Perfect / Great / Good / Miss timing judgments
- Combo-based score multiplier
- Persistent XP and player levels
- RhythmTap ID accounts powered by Supabase Auth
- Cloud-saved progression and statistics
- Public player profiles with usernames, display names, bios, profile accents, and privacy controls
- Player search and shareable public profile links
- Per-song and per-difficulty high scores
- Achievements and daily progression rewards
- Real-time two-player private multiplayer rooms
- Server-authoritative multiplayer result validation and anti-cheat checks
- Imported `.tap` chart support with locally stored custom audio
- Offline caching for played audio
- Performance/graphics controls for mobile devices

## Song library

RhythmTap currently supports the original built-in tracks plus supplied recorded tracks.

### Original tracks

- Midnight Voltage — NOVA//STATIC
- Afterglow Circuit — Luma Driver
- Zero Gravity — Phase Garden

### Recorded tracks

- Disturbed — Down With the Sickness
- blink-182 — If You Never Left
- Fly Like an Eagle (Metal version)
- Evanescence — My Immortal
- Ozzy Osbourne — Crazy Train
- Eminem — Kill You
- 3 Doors Down — Kryptonite
- DragonForce — Through the Fire and Flames

The newest five-song pack uses beat-aligned Easy, Normal, and Hard charts and is integrated with multiplayer validation and account progression. Audio files must exist in `public/audio/` using the filenames referenced by the song catalog before that pack is released.

> Recorded music is not granted a license by this repository. Only distribute recordings you have the necessary rights or permission to use.

## Player accounts and progression

Players can use RhythmTap without an account, but signing in with a **RhythmTap ID** enables persistent cloud progression.

Signed-in players can:

- Save XP and level progression across devices
- Track completed songs, Perfect hits, and best combo
- Save official-song high scores by difficulty
- Choose a unique username and display name
- Add a short bio and profile accent
- Make their profile public or private
- Search for other public players
- Share a public player profile

Progression data such as XP, level, song completions, and core statistics is server-owned rather than directly editable by the browser.

Official solo songs can award account XP. Custom imported charts do not award cloud XP, preventing trivial custom charts from being used to farm progression.

## Multiplayer

RhythmTap includes two-player real-time score battles using Supabase Realtime.

Players can:

1. Create a private room
2. Share the six-character room code
3. Join from another browser/device
4. Play a synchronized match
5. Compare server-verified results
6. Request a rematch

The multiplayer backend creates the match start time, validates chart identity, reconstructs the canonical chart, validates note IDs/lanes/timing, recomputes the official score, and stores verified results.

The validator rejects malformed or incomplete event logs, invalid lanes or note IDs, fake timing grades, duplicate judgments, early misses, invalid hold completions, metadata conflicts, and early match completion.

This substantially protects score integrity, but browser-based anti-cheat cannot guarantee that a custom client never synthesizes otherwise valid input.

## Gameplay timing

Judgment windows:

| Judgment | Window |
| --- | ---: |
| Perfect | ±55 ms |
| Great | ±110 ms |
| Good | ±220 ms |
| Miss | Outside Good window |

Scoring:

- Perfect: 1000 points
- Great: 700 points
- Good: 350 points
- Miss: 0 points
- Completed hold: 600 bonus points
- Multiplier increases with combo up to 4×

## Controls

### Mobile

Tap the three circular pads as notes reach the judgment line. For hold notes, keep your finger pressed until the note tail reaches the line.

### Desktop

- Left lane: `D`
- Center lane: `F`
- Right lane: `J`
- Pause: `Escape` or the on-screen pause button

## Imported charts

Open **My Charts** to import Phoenix-style `.tap` files.

Imported charts:

- Persist in browser storage
- Can use MP3, M4A, WAV, OGG, AAC, or FLAC audio
- Store attached audio locally in IndexedDB
- Support a saved ±500 ms chart offset adjustment
- Track high scores separately by chart and difficulty
- Do not upload the user's local audio to RhythmTap's backend

## Tech stack

- React
- TypeScript
- Vite
- Web Audio API / HTML Audio
- Supabase Auth
- Supabase Postgres
- Supabase Realtime
- Supabase Edge Functions
- GitHub Actions
- GitHub Pages

## Project structure

Key files and modules:

- `src/main.tsx` — core game, song library, gameplay, progression UI
- `src/audioChartData.ts` — onset-derived chart data for recorded tracks
- `src/multiplayer*.tsx` / `src/multiplayer*.ts` — multiplayer lobby, sessions, UI, and shared logic
- `src/player-account.tsx` — RhythmTap ID, profiles, player search, and cloud progression
- `scripts/multiplayer-transform.ts` — multiplayer integration transform
- `scripts/account-transform.ts` — player-account integration transform
- `scripts/song-pack-transform.ts` — additional song-pack catalog integration
- `supabase/functions/validate-match/` — authoritative multiplayer validator
- `supabase/migrations/` — database schema and progression migrations
- `tests/authoritative-validator.test.mjs` — anti-cheat and chart-validation tests

## Local development

Requirements:

- Node.js 22 or newer recommended
- npm

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

## Deployment

The production web app is hosted with GitHub Pages:

https://jonnyt123.github.io/Rhythtap/

Supabase provides authentication, persistent player data, Realtime multiplayer, database storage, and authoritative match validation.

Production Supabase migrations and Edge Function deployments are intentionally guarded in GitHub Actions and require repository deployment secrets.

## Adding an official song

An official recorded track normally requires:

1. Add the audio file under `public/audio/`
2. Add song metadata to the official catalog
3. Create Easy / Normal / Hard charts
4. Keep browser and authoritative multiplayer chart generation identical
5. Add the song ID to cloud progression eligibility if it should award XP
6. Add validator coverage
7. Run the full production build and anti-cheat test suite
8. Deploy any required backend changes before merging to `main`

Do not add or distribute commercial recordings unless you have the required rights or permission.

## Status

RhythmTap is under active development. Core solo gameplay, accounts, cloud progression, public profiles, custom chart importing, and authoritative two-player multiplayer are implemented. Real-world multiplayer behavior can still vary by browser/network conditions and should be tested across multiple devices when available.
