import {SONG_STORE_CATALOG} from './song-economy';

export type AchievementMilestoneType='first-clear'|'s-rank'|'full-combo';
export type AchievementMilestone={songId:string;difficulty:'ANY'|'EASY'|'NORMAL'|'HARD';milestone:AchievementMilestoneType;coinAwarded:number;earnedAt?:string};
export type MasteryDifficulty='EASY'|'NORMAL'|'HARD';
export type SongAchievementProgress={
 songId:string;
 unlocked:boolean;
 firstClear:boolean;
 sRanks:number;
 fullCombos:number;
 sRankDifficulties:MasteryDifficulty[];
 fullComboDifficulties:MasteryDifficulty[];
};
export type AchievementProgressSummary={
 unlockedSongs:number;
 totalSongs:number;
 firstClears:number;
 totalFirstClears:number;
 sRanks:number;
 totalSRanks:number;
 fullCombos:number;
 totalFullCombos:number;
 totalMilestones:number;
 earnedMilestones:number;
 songs:SongAchievementProgress[];
};

const OFFICIAL_IDS=new Set(SONG_STORE_CATALOG.map(entry=>entry.songId));
const DIFFICULTIES=new Set(['ANY','EASY','NORMAL','HARD']);
const MILESTONES=new Set<AchievementMilestoneType>(['first-clear','s-rank','full-combo']);

export const parseLocalCoinMilestones=(keys:string[]):AchievementMilestone[]=>{
 const out:AchievementMilestone[]=[];
 for(const key of keys){
  const [songId,difficulty,milestone]=String(key).split(':');
  if(!OFFICIAL_IDS.has(songId)||!DIFFICULTIES.has(difficulty)||!MILESTONES.has(milestone as AchievementMilestoneType))continue;
  out.push({songId,difficulty:difficulty as AchievementMilestone['difficulty'],milestone:milestone as AchievementMilestoneType,coinAwarded:0});
 }
 return out;
};

export const normalizeCloudCoinMilestones=(rows:unknown[]):AchievementMilestone[]=>{
 const out:AchievementMilestone[]=[];
 for(const raw of rows){
  const row=raw as Record<string,unknown>;
  const songId=String(row.song_id||''),difficulty=String(row.difficulty||''),milestone=String(row.milestone||'');
  if(!OFFICIAL_IDS.has(songId)||!DIFFICULTIES.has(difficulty)||!MILESTONES.has(milestone as AchievementMilestoneType))continue;
  out.push({
   songId,
   difficulty:difficulty as AchievementMilestone['difficulty'],
   milestone:milestone as AchievementMilestoneType,
   coinAwarded:Math.max(0,Number(row.coin_awarded)||0),
   earnedAt:typeof row.earned_at==='string'?row.earned_at:undefined
  });
 }
 return out;
};

export const buildAchievementProgress=(milestones:AchievementMilestone[],unlockedSongIds:string[]):AchievementProgressSummary=>{
 const unlocked=new Set(unlockedSongIds.filter(id=>OFFICIAL_IDS.has(id)));
 const seen=new Set<string>();
 const bySong=new Map<string,{first:boolean;s:Set<string>;fc:Set<string>}>();
 for(const entry of SONG_STORE_CATALOG)bySong.set(entry.songId,{first:false,s:new Set(),fc:new Set()});
 for(const item of milestones){
  if(!OFFICIAL_IDS.has(item.songId))continue;
  const key=`${item.songId}:${item.difficulty}:${item.milestone}`;
  if(seen.has(key))continue;
  seen.add(key);
  const bucket=bySong.get(item.songId)!;
  if(item.milestone==='first-clear')bucket.first=true;
  else if(item.milestone==='s-rank'&&item.difficulty!=='ANY')bucket.s.add(item.difficulty);
  else if(item.milestone==='full-combo'&&item.difficulty!=='ANY')bucket.fc.add(item.difficulty);
 }
 const songs=SONG_STORE_CATALOG.map(entry=>{
  const bucket=bySong.get(entry.songId)!;
  const order:MasteryDifficulty[]=['EASY','NORMAL','HARD'];
  return{
   songId:entry.songId,
   unlocked:unlocked.has(entry.songId),
   firstClear:bucket.first,
   sRanks:bucket.s.size,
   fullCombos:bucket.fc.size,
   sRankDifficulties:order.filter(difficulty=>bucket.s.has(difficulty)),
   fullComboDifficulties:order.filter(difficulty=>bucket.fc.has(difficulty))
  };
 });
 const firstClears=songs.filter(song=>song.firstClear).length;
 const sRanks=songs.reduce((sum,song)=>sum+song.sRanks,0);
 const fullCombos=songs.reduce((sum,song)=>sum+song.fullCombos,0);
 const totalSongs=SONG_STORE_CATALOG.length,totalSRanks=totalSongs*3,totalFullCombos=totalSongs*3;
 return{
  unlockedSongs:songs.filter(song=>song.unlocked).length,totalSongs,
  firstClears,totalFirstClears:totalSongs,
  sRanks,totalSRanks,
  fullCombos,totalFullCombos,
  earnedMilestones:firstClears+sRanks+fullCombos,
  totalMilestones:totalSongs+totalSRanks+totalFullCombos,
  songs
 };
};
