import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { songPackTransform } from './scripts/song-pack-transform.ts';
import { multiplayerTransform } from './scripts/multiplayer-transform.ts';
import { accountTransform } from './scripts/account-transform.ts';
import { metalMenuTransform } from './scripts/metal-menu-transform.ts';
import { stabilityTransform } from './scripts/stability-transform.ts';
import { weightedChartTransform } from './scripts/weighted-chart-transform.ts';
import { battleExperienceTransform } from './scripts/battle-experience-transform.ts';
import { accountRecoveryTransform } from './scripts/account-recovery-transform.ts';
import { battleLobbyUsabilityTransform } from './scripts/battle-lobby-usability-transform.ts';
import { multiplayerSessionLoopTransform } from './scripts/multiplayer-session-loop-transform.ts';
import { multiplayerHardeningTransform } from './scripts/multiplayer-hardening-transform.ts';
import { tourSocialRankedTransform } from './scripts/tour-social-ranked-transform.ts';
import { pr13ReviewFixesTransform } from './scripts/pr13-review-fixes-transform.ts';
import { tourSetCareerTransform } from './scripts/tour-set-career-transform.ts';
import { gameplayQualityTransform } from './scripts/gameplay-quality-transform.ts';
import { highResolutionMediaClockTransform } from './scripts/high-resolution-media-clock-transform.ts';
import { engagementUiTransform } from './scripts/engagement-ui-transform.ts';
import { stripeBillingTransform } from './scripts/stripe-billing-transform.ts';

const isVercel = Boolean((globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.VERCEL);

export default defineConfig({
  plugins: [weightedChartTransform(), songPackTransform(), multiplayerTransform(), accountTransform(), metalMenuTransform(), stabilityTransform(), battleExperienceTransform(), accountRecoveryTransform(), battleLobbyUsabilityTransform(), multiplayerSessionLoopTransform(), multiplayerHardeningTransform(), tourSocialRankedTransform(), pr13ReviewFixesTransform(), tourSetCareerTransform(), gameplayQualityTransform(), highResolutionMediaClockTransform(), engagementUiTransform(), stripeBillingTransform(), react()],
  base: isVercel ? '/' : '/Rhythtap/',
});
