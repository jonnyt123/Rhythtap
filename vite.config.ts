import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { multiplayerTransform } from './scripts/multiplayer-transform.ts';
import { accountTransform } from './scripts/account-transform.ts';
import { metalMenuTransform } from './scripts/metal-menu-transform.ts';
import { stabilityTransform } from './scripts/stability-transform.ts';
import { weightedChartTransform } from './scripts/weighted-chart-transform.ts';
import { battleExperienceTransform } from './scripts/battle-experience-transform.ts';
import { accountRecoveryTransform } from './scripts/account-recovery-transform.ts';
import { battleLobbyUsabilityTransform } from './scripts/battle-lobby-usability-transform.ts';
import { accountSessionTransform } from './scripts/account-session-transform.ts';
import { multiplayerSessionLoopTransform } from './scripts/multiplayer-session-loop-transform.ts';
import { tourSocialRankedTransform } from './scripts/tour-social-ranked-transform.ts';
import { pr13ReviewFixesTransform } from './scripts/pr13-review-fixes-transform.ts';
import { tourSetCareerTransform } from './scripts/tour-set-career-transform.ts';
import { gameplayQualityTransform } from './scripts/gameplay-quality-transform.ts';
import { highResolutionMediaClockTransform } from './scripts/high-resolution-media-clock-transform.ts';
import { denseNoteMatcherTransform } from './scripts/dense-note-matcher-transform.ts';
import { chartV4RolloutTransform } from './scripts/chart-v4-rollout-transform.ts';
import { scoreVersionV5Transform } from './scripts/score-version-v5-transform.ts';
import { engagementUiTransform } from './scripts/engagement-ui-transform.ts';

const isVercel = Boolean((globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.VERCEL);

export default defineConfig({
  plugins: [weightedChartTransform(), multiplayerTransform(), accountTransform(), metalMenuTransform(), stabilityTransform(), accountSessionTransform(), battleExperienceTransform(), accountRecoveryTransform(), battleLobbyUsabilityTransform(), multiplayerSessionLoopTransform(), tourSocialRankedTransform(), pr13ReviewFixesTransform(), tourSetCareerTransform(), gameplayQualityTransform(), highResolutionMediaClockTransform(), denseNoteMatcherTransform(), chartV4RolloutTransform(), scoreVersionV5Transform(), engagementUiTransform(), react()],
  base: isVercel ? '/' : '/Rhythtap/',
});
