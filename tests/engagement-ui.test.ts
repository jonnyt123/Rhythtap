import {assert,assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const transform=await Deno.readTextFile('scripts/engagement-ui-transform.ts');
const vite=await Deno.readTextFile('vite.config.ts');
const analytics=await Deno.readTextFile('src/engagement-analytics.ts');
const css=await Deno.readTextFile('src/engagement-ui.css');

Deno.test('engagement transform is last pre-react UI transform',()=>{
 const chart=vite.indexOf('chartV4RolloutTransform()');
 const engagement=vite.indexOf('engagementUiTransform()');
 const react=vite.indexOf('react()');
 assert(chart>=0&&engagement>chart&&react>engagement);
});

Deno.test('engagement release does not patch gameplay timing or charts',()=>{
 assertEquals(transform.includes('gameplay-timing'),false);
 assertEquals(transform.includes('weighted-chart'),false);
 assertEquals(transform.includes('validator'),false);
 assertEquals(transform.includes('TIMING.'),false);
});

Deno.test('core funnel events are instrumented',()=>{
 for(const event of ['game_open','mode_selected','song_selected','difficulty_selected','song_started','song_completed','song_retry','results_continue'])assert(analytics.includes(`'${event}'`)&&transform.includes(`name:'${event}'`),event);
});

Deno.test('analytics remains non-blocking',()=>{
 assert(analytics.includes("console.warn('[engagement] event skipped"));
 assert(transform.includes('void trackEngagement'));
});

Deno.test('mobile and reduced motion polish is present',()=>{
 assert(css.includes('@media(max-width:620px)'));
 assert(css.includes('@media(prefers-reduced-motion:reduce)'));
});
