import {assert} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const polish=await Deno.readTextFile('src/death-metal-polish.css');
const metalTransform=await Deno.readTextFile('scripts/metal-menu-transform.ts');
const v5=await Deno.readTextFile('supabase/functions/_shared/weighted-chart-v5.ts');
const validateMatch=await Deno.readTextFile('supabase/functions/validate-match/index.ts');
const recordSolo=await Deno.readTextFile('supabase/functions/record-solo/index.ts');
const scoreVersion=await Deno.readTextFile('scripts/score-version-v5-transform.ts');
const gameplayQuality=await Deno.readTextFile('scripts/gameplay-quality-transform.ts');
const migration=await Deno.readTextFile('supabase/migrations/20260906054059_complete_v5_score_versioning.sql');

Deno.test('remaining major routes are explicitly metal-themed',()=>{
 assert(polish.includes('.tutorial-screen{'));
 assert(polish.includes('.account-screen{'));
 assert(polish.includes('.tsr-screen{'));
 assert(polish.includes('.mp-game-hud-v2{'));
 assert(metalTransform.includes("import './death-metal-polish.css';"));
});

Deno.test('gameplay readability survives the theme',()=>{
 assert(polish.includes('.note.hold:before{opacity:1!important}'));
 assert(polish.includes('.feedback .miss{color:#f05b55!important}'));
 assert(polish.includes('.graphics-low .note:not(.hold){box-shadow:'));
 assert(polish.includes('.xp-line span:first-child,.graphics-options button.active small,.theme-options button.active small{color:#ef766e!important}'));
});

Deno.test('Hard V5 density keeps two-note chords atomic',()=>{
 assert(v5.includes('const chosen=group.slice(0,HARD_MAX_CHORD);'));
 assert(v5.includes('chosen.length>room'));
 assert(!v5.includes('Math.min(HARD_MAX_CHORD,room)'));
});

Deno.test('V5 result plumbing is complete',()=>{
 assert(validateMatch.includes(".in('validation_version',[2,3,4,5])"));
 assert(recordSolo.includes('p_chart_version:chartVersion'));
 assert(scoreVersion.includes("difficulty==='HARD'?'-v5':''"));
 assert(scoreVersion.includes("or('difficulty.neq.HARD,chart_version.eq.5')"));
 assert(scoreVersion.includes("eq('chart_version',difficulty==='HARD'?5:4)"));
});

Deno.test('database migration versions V5 matches and scores',()=>{
 assert(migration.includes('check (chart_version in (3,4,5))'));
 assert(migration.includes('primary key (user_id, song_id, difficulty, chart_version)'));
 assert(migration.includes('p_chart_version integer default 4'));
 assert(migration.includes("case when p_difficulty = 'HARD' then p_chart_version else 4 end"));
 assert(migration.includes("case when validated.difficulty = 'HARD' then validated.validation_version else 4 end"));
});

Deno.test('mobile-first rendering is an intentional product contract',()=>{
 assert(gameplayQuality.includes("adaptiveLow||phoneGameplay?'LOW':graphicsMode"));
 assert(!gameplayQuality.includes("phoneGameplay&&difficulty==='HARD'"));
});
