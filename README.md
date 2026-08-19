# Neon Tap: Recharged

An original four-lane browser rhythm game built with React, TypeScript, Vite and the Web Audio API. It does not contain Tap Tap Revenge branding, artwork, music, charts, or other proprietary assets.

Play online: https://jonnyt123.github.io/Rhythtap/

## Run

```bash
npm install
npm run dev
```

## Controls

- Desktop: D, F, J, K
- Mobile: tap the four colored pads
- Escape or the pause button pauses the track

## Timing

The oscillator-backed transport and notes share the `AudioContext.currentTime` clock. Windows are Perfect ±45 ms, Great ±90 ms, Good ±180 ms, then Miss. Device offset and note speed are saved locally.

## Add a track

Add a `Song` entry in `src/main.tsx`. Charts use millisecond timestamps and lane indexes 0–3. A note may include `duration` for a hold visual.

## Build

```bash
npm run build
```
