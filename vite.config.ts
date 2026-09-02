import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { songPackTransform } from './scripts/song-pack-transform';
import { multiplayerTransform } from './scripts/multiplayer-transform';
import { accountTransform } from './scripts/account-transform';
import { metalMenuTransform } from './scripts/metal-menu-transform';
import { gameplayPositionFixTransform } from './scripts/gameplay-position-fix-transform';
import { stabilityTransform } from './scripts/stability-transform';
import { weightedChartTransform } from './scripts/weighted-chart-transform';
import { battleExperienceTransform } from './scripts/battle-experience-transform';
import { accountRecoveryTransform } from './scripts/account-recovery-transform';
import { battleLobbyUsabilityTransform } from './scripts/battle-lobby-usability-transform';
import { accountSessionTransform } from './scripts/account-session-transform';
import { multiplayerSessionLoopTransform } from './scripts/multiplayer-session-loop-transform';
import { tourSocialRankedTransform } from './scripts/tour-social-ranked-transform';
import { pr13ReviewFixesTransform } from './scripts/pr13-review-fixes-transform';
import { tourSetlistCareerTransform } from './scripts/tour-setlist-career-transform';

const isVercel = Boolean((globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.VERCEL);

export default defineConfig({
  plugins: [weightedChartTransform(), songPackTransform(), multiplayerTransform(), accountTransform(), metalMenuTransform(), gameplayPositionFixTransform(), stabilityTransform(), accountSessionTransform(), battleExperienceTransform(), accountRecoveryTransform(), battleLobbyUsabilityTransform(), multiplayerSessionLoopTransform(), tourSocialRankedTransform(), pr13ReviewFixesTransform(), tourSetlistCareerTransform(), react()],
  base: isVercel ? '/' : '/Rhythtap/',
});