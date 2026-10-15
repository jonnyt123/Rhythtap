import {assert,assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {buildAchievementProgress,normalizeCloudCoinMilestones,parseLocalCoinMilestones} from '../src/achievement-progress.ts';
import {STARTER_SONG_IDS} from '../src/song-economy.ts';

const component=await Deno.readTextFile('src/progression-achievements.tsx');
const transform=await Deno.readTextFile('scripts/progression-achievements-transform.ts');
const css=await Deno.readTextFile('src/progression-achievements.css');
const vite=await Deno.readTextFile('vite.config.ts');

Deno.test('local milestone keys map into setlist mastery progress',()=>{
 const milestones=parseLocalCoinMilestones([
  'voltage:ANY:first-clear',
  'voltage:NORMAL:s-rank',
  'voltage:NORMAL:full-combo',
  'voltage:HARD:s-rank',
  'not-real:NORMAL:s-rank',
  'voltage:NORMAL:nope'
 ]);
 assertEquals(milestones.length,4);
 const progress=buildAchievementProgress(milestones,STARTER_SONG_IDS);
 assertEquals(progress.totalSongs,11);
 assertEquals(progress.totalFirstClears,11);
 assertEquals(progress.totalSRanks,33);
 assertEquals(progress.totalFullCombos,33);
 assertEquals(progress.totalMilestones,77);
 assertEquals(progress.unlockedSongs,4);
 assertEquals(progress.firstClears,1);
 assertEquals(progress.sRanks,2);
 assertEquals(progress.fullCombos,1);
 assertEquals(progress.earnedMilestones,4);
 const voltage=progress.songs.find(song=>song.songId==='voltage')!;
 assert(voltage.unlocked);
 assert(voltage.firstClear);
 assertEquals(voltage.sRanks,2);
 assertEquals(voltage.fullCombos,1);
});

Deno.test('cloud milestone normalizer rejects unknown or malformed rows',()=>{
 const milestones=normalizeCloudCoinMilestones([
  {song_id:'afterglow',difficulty:'EASY',milestone:'s-rank',coin_awarded:10,earned_at:'2026-10-14T00:00:00Z'},
  {song_id:'afterglow',difficulty:'ANY',milestone:'first-clear',coin_awarded:15},
  {song_id:'fake',difficulty:'EASY',milestone:'s-rank',coin_awarded:10},
  {song_id:'afterglow',difficulty:'EXTREME',milestone:'full-combo',coin_awarded:15}
 ]);
 assertEquals(milestones.length,2);
 assertEquals(milestones[0].coinAwarded,10);
});

Deno.test('achievement screen uses signed-in cloud milestones with local fallback',()=>{
 assert(component.includes("player_song_coin_milestones"));
 assert(component.includes("LOCAL FALLBACK"));
 assert(component.includes("CLOUD SYNCED"));
 assert(component.includes("cloudUnlockedSongIds"));
 assert(component.includes("localEconomy.coinMilestones"));
 assert(component.includes("SONG MASTERY"));
 assert(component.includes("FIRST CLEARS"));
 assert(component.includes("S RANKS"));
 assert(component.includes("FULL COMBOS"));
 assert(component.includes("COINS TO UNLOCK"));
});

Deno.test('achievement UI is wired after store and coin transforms',()=>{
 assert(transform.includes("ProgressionAchievementsScreen"));
 assert(transform.includes("playerAccount.unlockedSongIds"));
 assert(transform.includes("localEconomy={localSongEconomy}"));
 assert(vite.indexOf('coinBonusTransform()')<vite.indexOf('progressionAchievementsTransform()'));
 assert(css.includes('.progress-achievements-scroll{'));
 assert(css.includes('env(safe-area-inset-bottom)'));
 assert(css.includes('@media(max-width:430px)'));
 assert(css.includes('@media(prefers-reduced-motion:reduce)'));
});
