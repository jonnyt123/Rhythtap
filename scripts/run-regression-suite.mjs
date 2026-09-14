import {execFileSync} from 'node:child_process';

const run=(cmd,args)=>{console.log(`\n> ${cmd} ${args.join(' ')}`);execFileSync(cmd,args,{stdio:'inherit',env:process.env});};

run('npx',['tsc','supabase/functions/validate-match/validator.ts','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext','--skipLibCheck','--outDir','.validator-ci']);
run('node',['tests/authoritative-validator.test.mjs']);
run('node',['tests/stability-regressions.test.mjs']);

const denoTests=[
 ['tests/gameplay-quality.test.ts'],
 ['tests/input-timing.test.ts'],
 ['tests/media-clock.test.ts'],
 ['tests/dense-note-matcher.test.ts'],
 ['tests/game-preroll.test.ts'],
 ['tests/song-fail.test.ts'],
 ['tests/multiplayer-hardening.test.ts'],
 ['--node-modules-dir=auto','tests/chart-version-compat.test.ts'],
 ['--node-modules-dir=auto','tests/chart-quality-v4.test.ts'],
 ['--node-modules-dir=auto','tests/chart-quality-v5.test.ts'],
 ['tests/engagement-ui.test.ts'],
 ['tests/mobile-layout.test.ts'],
 ['tests/scrolling-regression.test.ts'],
 ['tests/death-metal-theme.test.ts'],
 ['tests/pr21-release-hardening.test.ts'],
 ['tests/stripe-billing.test.ts'],
 ['tests/pro-badge.test.ts'],
 ['--node-modules-dir=auto','tests/weighted-v3-parity.test.ts'],
];
for(const args of denoTests)run('deno',['test','--allow-read',...args]);
console.log('\nRegression release gate: PASS');
