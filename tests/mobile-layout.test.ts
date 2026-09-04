import {assert} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const engagement=await Deno.readTextFile('src/engagement-ui.css');
const tutorial=await Deno.readTextFile('src/rhythmtap-tutorial.css');
const base=await Deno.readTextFile('src/styles.css');
const gameplay=await Deno.readTextFile('src/gameplay-position-fix.css');

Deno.test('core screens use dynamic viewport and safe areas',()=>{
 assert(base.includes('height:100dvh'));
 assert(base.includes('env(safe-area-inset-top)'));
 assert(base.includes('env(safe-area-inset-bottom)'));
 assert(tutorial.includes('min-height:100dvh'));
 assert(tutorial.includes('safe-area-inset-bottom'));
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

Deno.test('gameplay note translation regression protection remains active',()=>{
 assert(gameplay.includes('translate3d(-50%,var(--note-y),0)'));
 assert(gameplay.includes('.game.theme-diamond .note:not(.hold)'));
 assert(gameplay.includes('.game.theme-hex .note:not(.hold)'));
});

Deno.test('gameplay uses circular receptors without shrinking touch targets',()=>{
 assert(gameplay.includes('.game .lane:after'));
 assert(gameplay.includes('border-radius:50%'));
 assert(gameplay.includes('width:56px'));
 assert(gameplay.includes('.game .pad{'));
 assert(gameplay.includes('background:transparent'));
 assert(!gameplay.includes('.game .pad{width:56px'));
});
