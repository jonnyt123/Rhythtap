import {assert} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const engagement=await Deno.readTextFile('src/engagement-ui.css');
const tutorial=await Deno.readTextFile('src/rhythmtap-tutorial.css');
const tutorialReceptors=await Deno.readTextFile('src/receptor-tutorial.css');
const base=await Deno.readTextFile('src/styles.css');
const gameplay=await Deno.readTextFile('src/gameplay-position-fix.css');
const metal=await Deno.readTextFile('src/death-metal-theme.css');
const profile=await Deno.readTextFile('src/player-profile-console.css');
const mobilePerf=await Deno.readTextFile('src/mobile-gameplay-performance.css');
const multiplayer=await Deno.readTextFile('src/multiplayer.css');
const tour=await Deno.readTextFile('src/tour-social-ranked.tsx');
const tourDifficulty=await Deno.readTextFile('src/tour-difficulty.css');

Deno.test('core screens use dynamic viewport and safe areas',()=>{
 assert(base.includes('height:100dvh'));
 assert(base.includes('env(safe-area-inset-top)'));
 assert(base.includes('env(safe-area-inset-bottom)'));
 assert(tutorial.includes('min-height:100dvh'));
 assert(tutorial.includes('safe-area-inset-bottom'));
});

Deno.test('multiplayer lobby can vertically scroll on mobile despite global screen clipping',()=>{
 assert(multiplayer.includes('.multiplayer{height:100dvh;min-height:100dvh;overflow-y:auto;overflow-x:hidden'));
 assert(multiplayer.includes('-webkit-overflow-scrolling:touch'));
 assert(multiplayer.includes('overscroll-behavior-y:contain'));
 assert(multiplayer.includes('touch-action:pan-y'));
 assert(multiplayer.includes('env(safe-area-inset-bottom)'));
});

Deno.test('short mobile engagement layouts reserve controls space',()=>{
 assert(engagement.includes('.engagement-select-summary~.songlist'));
 assert(engagement.includes('@media(max-height:700px)'));
 assert(engagement.includes('max-height:calc(100dvh - 250px)'));
 assert(engagement.includes('.engagement-result-actions .primary,.engagement-result-actions .secondary{min-height:46px}'));
});

Deno.test('tutorial controls remain mobile input safe',()=>{
 assert(tutorial.includes('touch-action:none'));
 assert(tutorial.includes('position:fixed'));
 assert(tutorial.includes('env(safe-area-inset-bottom)'));
});

Deno.test('tutorial receptor is covered by the lane touch target',()=>{
 assert(tutorialReceptors.includes('.demo-receptors{'));
 assert(tutorialReceptors.includes('bottom:122px'));
 assert(tutorialReceptors.includes('.demo-pads{z-index:6;height:190px'));
 assert(tutorialReceptors.includes('.demo-note{z-index:5;pointer-events:none}'));
 assert(!tutorialReceptors.includes('.demo-pads{z-index:2}'));
});

Deno.test('gameplay note translation regression protection remains active',()=>{
 assert(gameplay.includes('translate3d(-50%,var(--note-y),0)'));
 assert(gameplay.includes('.game.theme-diamond .note:not(.hold)'));
 assert(gameplay.includes('.game.theme-hex .note:not(.hold)'));
});

Deno.test('gameplay receptor, touch zone, and hold glow share the 89 percent judgment coordinate',()=>{
 assert(gameplay.includes('.game .lane:after'));
 assert(gameplay.includes('top:89%'));
 assert(gameplay.includes('transform:translate(-50%,-50%)'));
 assert(gameplay.includes('border-radius:50%'));
 assert(gameplay.includes('.game .pad{'));
 assert(gameplay.includes('top:calc(89% - 66px)'));
 assert(gameplay.includes('height:132px'));
 assert(gameplay.includes('width:92%'));
 assert(gameplay.includes('.game .lane.holding:before'));
 assert(gameplay.includes('background:transparent'));
 assert(!gameplay.includes('bottom:78px'));
});

Deno.test('metal polish is explicitly mobile-first across target iPhone classes',()=>{
 assert(metal.includes('Phone is the product target'));
 assert(metal.includes('@media(max-width:699px)'));
 assert(metal.includes('@media(max-width:699px) and (max-height:667px)'));
 assert(metal.includes('.arena{top:68px;width:100%;filter:none!important}'));
 assert(metal.includes('.settingsPage{overflow-y:auto;overscroll-behavior:contain'));
 assert(metal.includes('.song{height:88px'));
 assert(metal.includes('.playdock{left:12px;right:12px;bottom:max(10px,env(safe-area-inset-bottom))'));
 assert(metal.includes('.song{height:80px'));
 const targetViewports=['320x568','375x667','390x844','430x932'];
 assert(targetViewports.length===4);
});

Deno.test('console-style player profile stays compact and metal-themed on iPhone',()=>{
 assert(profile.includes('.account-screen .profile-hero{'));
 assert(profile.includes('clip-path:polygon(9px 0'));
 assert(profile.includes('.account-screen .account-stats{grid-template-columns:repeat(4,minmax(0,1fr))'));
 assert(profile.includes('@media(max-width:620px)'));
 assert(profile.includes('grid-template-columns:58px minmax(0,1fr) auto'));
 assert(profile.includes('.account-screen .account-stats{grid-template-columns:repeat(2,minmax(0,1fr))'));
 assert(profile.includes('.account-screen .rt-username-plate{max-width:min(150px,46vw)'));
 assert(profile.includes('@media(max-width:380px)'));
 assert(profile.includes('env(safe-area-inset-left)'));
 assert(profile.includes('prefers-reduced-motion:reduce'));
});

Deno.test('mobile gameplay cuts paint cost without moving the timing geometry',()=>{
 assert(mobilePerf.includes('@media (pointer:coarse) and (max-width:768px)'));
 assert(mobilePerf.includes('contain:layout paint style'));
 assert(mobilePerf.includes('will-change:transform'));
 assert(mobilePerf.includes('.game .hit-burst{display:none!important}'));
 assert(mobilePerf.includes('.game .lane.holding:before{filter:none!important'));
 assert(mobilePerf.includes('.game .note.active-hold{animation:none!important'));
 assert(gameplay.includes('top:89%'));
 assert(gameplay.includes('translate3d(-50%,var(--note-y),0)'));
});

Deno.test('Tour exposes Easy Normal and Hard before starting each unlocked gig',()=>{
 assert(tour.includes("const DIFFICULTIES=['EASY','NORMAL','HARD'] as TourDifficulty[]"));
 assert(tour.includes('selectedDifficulty'));
 assert(tour.includes('className="tour-difficulty"'));
 assert(tour.includes('aria-pressed={difficulty===d}'));
 assert(tour.includes('onPlay(song.id,difficulty,{gigId:gig.id})'));
 assert(!tour.includes('onPlay(song.id,gig.min'));
 assert(tour.includes('PLAY {difficulty}'));
 assert(tourDifficulty.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
 assert(tourDifficulty.includes('@media(max-width:620px)'));
});