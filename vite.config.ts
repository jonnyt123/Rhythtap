import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { songPackTransform } from './scripts/song-pack-transform';
import { multiplayerTransform } from './scripts/multiplayer-transform';
import { accountTransform } from './scripts/account-transform';

export default defineConfig({
  plugins: [songPackTransform(), multiplayerTransform(), accountTransform(), react()],
  base: '/Rhythtap/',
});
