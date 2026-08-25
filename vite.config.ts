import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { songPackTransform } from './scripts/song-pack-transform';
import { multiplayerTransform } from './scripts/multiplayer-transform';
import { accountTransform } from './scripts/account-transform';
import { metalMenuTransform } from './scripts/metal-menu-transform';

export default defineConfig({
  plugins: [songPackTransform(), multiplayerTransform(), accountTransform(), metalMenuTransform(), react()],
  base: '/Rhythtap/',
});
