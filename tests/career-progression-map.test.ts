import {assert,assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {buildAchievementProgress,parseLocalCoinMilestones} from '../src/achievement-progress.ts';
import {buildCareerRoadmap,nextCareerGoalForSong} from '../src/career-progression-model.ts';
import {STARTER_SONG_IDS} from '../src/song-economy.ts';

const component=await Deno.readTextFile('src/career-progression-map.tsx');
const achievementScreen=await Deno.readTextFile('src/progression-achievements.tsx');
const transform=await Deno.readTextFile('scripts/progression-achievements-transform.ts');
const css=await Deno.readTextFile('src/career-progression-map.css');

Deno.test('career route advances through first clear then difficulty mastery',()=>{
 const progress=buildAchievementProgress(parseLocalCoinMilestones([]),STARTER_SONG_IDS);
 const route=buildCareerRoadmap(progress);
 assertEquals(route.length,11);
 assertEquals(route[0].song.songId,'voltage');
 assert(route[0].current);
 assertEquals(route[0].goal.kind,'first-clear');
 assertEquals(route[0].goal.difficulty,'NORMAL');

 const voltage={...progress.songs[0],firstClear:true,sRanks:0,fullCombos:0,sRankDifficulties:[],fullComboDifficulties:[]};
 assertEquals(nextCareerGoalForSong(voltage,0),{
  kind:'s-rank',difficulty:'EASY',label:'EASY S RANK',detail:'Reach 95%+ accuracy',actionLabel:'PLAY EASY'
 });

 const easyS={...voltage,sRanks:1,sRankDifficulties:['EASY' as const]};
 assertEquals(nextCareerGoalForSong(easyS,0).kind,'full-combo');
 assertEquals(nextCareerGoalForSong(easyS,0).difficulty,'EASY');

 const easyDone={...easyS,fullCombos:1,fullComboDifficulties:['EASY' as const]};
 assertEquals(nextCareerGoalForSong(easyDone,0).difficulty,'NORMAL');
});

Deno.test('locked songs route players to the store with real price',()=>{
 const progress=buildAchievementProgress(parseLocalCoinMilestones([]),STARTER_SONG_IDS);
 const afterglow=progress.songs.find(song=>song.songId==='afterglow')!;
 const goal=nextCareerGoalForSong(afterglow,200);
 assertEquals(goal.kind,'unlock');
 assertEquals(goal.actionLabel,'OPEN STORE');
 assert(goal.detail.includes('200'));
});

Deno.test('fully mastered song yields mastered state',()=>{
 const progress=buildAchievementProgress(parseLocalCoinMilestones([
  'voltage:ANY:first-clear',
  'voltage:EASY:s-rank','voltage:EASY:full-combo',
  'voltage:NORMAL:s-rank','voltage:NORMAL:full-combo',
  'voltage:HARD:s-rank','voltage:HARD:full-combo'
 ]),STARTER_SONG_IDS);
 const voltage=progress.songs.find(song=>song.songId==='voltage')!;
 assertEquals(voltage.sRankDifficulties,['EASY','NORMAL','HARD']);
 assertEquals(voltage.fullComboDifficulties,['EASY','NORMAL','HARD']);
 const goal=nextCareerGoalForSong(voltage,0);
 assertEquals(goal.kind,'mastered');
 const route=buildCareerRoadmap(progress);
 assert(!route[0].current);
 assert(route[1].current);
});

Deno.test('career map is reachable and sends next actions to setlist or store',()=>{
 assert(achievementScreen.includes("OPEN CAREER MAP"));
 assert(achievementScreen.includes("setView('career')"));
 assert(achievementScreen.includes("CareerProgressionMap"));
 assert(component.includes("RECOMMENDED NEXT"));
 assert(component.includes("MASTER THE SETLIST"));
 assert(component.includes("openStore()"));
 assert(component.includes("openSong(current.song.songId"));
 assert(transform.includes("coins={coinBalance}"));
 assert(transform.includes("openStore={()=>setScreen('store')}"));
 assert(transform.includes("setDifficulty(difficulty);setScreen('select')"));
});

Deno.test('career map remains phone-safe and accessible',()=>{
 assert(css.includes('env(safe-area-inset-bottom)'));
 assert(css.includes('overflow-x:hidden'));
 assert(css.includes('@media(max-width:430px)'));
 assert(css.includes('@media(prefers-reduced-motion:reduce)'));
 assert(component.includes('aria-label="Career setlist progression"'));
 assert(component.includes('aria-label="Back to achievements"'));
});
