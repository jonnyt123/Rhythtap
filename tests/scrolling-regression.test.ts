import {assert} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const base=await Deno.readTextFile('src/styles.css');
const fixes=await Deno.readTextFile('src/screen-scroll-fixes.css');
const ux=await Deno.readTextFile('src/ux.css');
const career=await Deno.readTextFile('src/tour-set-career.tsx');
const multiplayer=await Deno.readTextFile('src/multiplayer-lobby.tsx');
const account=await Deno.readTextFile('src/player-account.tsx');
const social=await Deno.readTextFile('src/tour-social-ranked.tsx');
const main=await Deno.readTextFile('src/main.tsx');

Deno.test('content-heavy full-screen routes override the clipped base screen shell',()=>{
 assert(base.includes('.screen{height:100dvh'));
 assert(base.includes('overflow:hidden'));
 const selectors=[
  '.multiplayer.screen',
  '.career-tour.screen',
  '.account-screen.screen',
  '.tsr-screen.screen',
  '.imported-library.screen',
  '.chart-leaderboard.screen',
  '.settingsPage.screen',
  '.achievementsPage.screen',
  '.results.screen',
 ];
 for(const selector of selectors)assert(fixes.includes(selector),`Missing scroll ownership for ${selector}`);
 assert(fixes.includes('overflow-y:auto'));
 assert(fixes.includes('overflow-x:hidden'));
 assert(fixes.includes('overscroll-behavior-y:contain'));
 assert(fixes.includes('-webkit-overflow-scrolling:touch'));
 assert(fixes.includes('touch-action:pan-y'));
});

Deno.test('route roots still use the selectors covered by the shared scroll contract',()=>{
 assert(career.includes('className="career-tour screen"'));
 assert(multiplayer.includes('multiplayer screen')||multiplayer.includes('screen multiplayer'));
 assert(account.includes('account-screen screen')||account.includes('screen account-screen'));
 assert(social.includes('tsr-screen screen')||social.includes('screen tsr-screen'));
 assert(main.includes('className="imported-library screen"'));
 assert(main.includes('className="chart-leaderboard screen"'));
 assert(main.includes('className="settingsPage screen"'));
 assert(main.includes('className="achievementsPage screen"'));
 assert(main.includes('className="results screen"'));
});

Deno.test('fixed-stage screens keep dedicated inner scrollers and gameplay stays fixed',()=>{
 assert(ux.includes('.home-content{'));
 assert(ux.includes('overflow:auto'));
 assert(ux.includes('.select .songlist'));
 assert(ux.includes('overflow-y:auto'));
 assert(fixes.includes('.home .home-content'));
 assert(fixes.includes('.select .songlist'));
 assert(!fixes.includes('.game.screen,'));
 assert(!fixes.includes('.game.screen{'));
});
