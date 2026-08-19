# Neon Tap: Recharged

An original four-lane browser rhythm game built with React, TypeScript, Vite and the Web Audio API. It does not contain Tap Tap Revenge branding, artwork, music, charts, or other proprietary assets.

Each track has Easy, Normal, and Hard charts generated from the same pitch sequence and timestamps as its audible lead melody. Music is generated in real time from original track-specific arrangements with layered kick, snare, hi-hat, bass, chord, and lead synthesizers.

Completed tracks award difficulty-scaled XP. Player level and progress persist locally; Afterglow Circuit unlocks at level 2 and Zero Gravity unlocks at level 4.

## Licensed audio tracks

- Disturbed — Down With the Sickness
- blink-182 — If You Never Left
- Fly Like an Eagle (Metal version)

These supplied recordings are loaded through the same Web Audio clock used for note judgment. Each includes independently generated Easy, Normal, and Hard beat-grid charts. Distribution permission was confirmed by the project owner.

Play online: https://jonnyt123.github.io/Rhythtap/

## Run

```bash
npm install
npm run dev
```

## Controls

- Desktop: D, F, J, K
- Mobile: tap the four colored pads; press and sustain long notes until their tails reach the judgment line
- Escape or the pause button pauses the track

## Timing

The oscillator-backed transport and notes share the `AudioContext.currentTime` clock. Windows are Perfect ±45 ms, Great ±90 ms, Good ±180 ms, then Miss. Device offset and note speed are saved locally.

## Add a track

Add a `Song` entry in `src/main.tsx` with its harmonic progression, melody, and three difficulty charts. Charts use millisecond timestamps and lane indexes 0–3. Add `duration` to create a fully judged hold note.

## Build

```bash
npm run build
```
