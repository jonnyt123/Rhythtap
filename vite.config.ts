import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { multiplayerTransform } from './scripts/multiplayer-transform';

export default defineConfig({
  plugins: [multiplayerTransform(), react()],
  base: '/Rhythtap/',
});
