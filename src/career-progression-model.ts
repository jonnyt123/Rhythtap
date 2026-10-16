import type {AchievementProgressSummary,MasteryDifficulty,SongAchievementProgress} from './achievement-progress';
import {SONG_STORE_CATALOG} from './song-economy';

export type CareerGoalKind='unlock'|'first-clear'|'s-rank'|'full-combo'|'mastered';
export type CareerGoal={kind:CareerGoalKind;difficulty?:MasteryDifficulty;label:string;detail:string;actionLabel:string};
export type CareerRoadNode={
 song:SongAchievementProgress;
 goal:CareerGoal;
 masteryCount:number;
 masteryTotal:number;
 masteryPercent:number;
 current:boolean;
 price:number;
};

export const MASTERY_DIFFICULTY_ORDER:MasteryDifficulty[]=['EASY','NORMAL','HARD'];

export const nextCareerGoalForSong=(song:SongAchievementProgress,price:number):CareerGoal=>{
 if(!song.unlocked)return{kind:'unlock',label:'UNLOCK TRACK',detail:`${price.toLocaleString()} coins required`,actionLabel:'OPEN STORE'};
 if(!song.firstClear)return{kind:'first-clear',difficulty:'NORMAL',label:'FIRST CLEAR',detail:'Finish the song on any difficulty',actionLabel:'PLAY NORMAL'};
 for(const difficulty of MASTERY_DIFFICULTY_ORDER){
  if(!song.sRankDifficulties.includes(difficulty))return{kind:'s-rank',difficulty,label:`${difficulty} S RANK`,detail:'Reach 95%+ accuracy',actionLabel:`PLAY ${difficulty}`};
  if(!song.fullComboDifficulties.includes(difficulty))return{kind:'full-combo',difficulty,label:`${difficulty} FULL COMBO`,detail:'Finish with zero misses',actionLabel:`PLAY ${difficulty}`};
 }
 return{kind:'mastered',label:'MASTERED',detail:'All 7 mastery goals complete',actionLabel:'PLAY AGAIN'};
};

export const buildCareerRoadmap=(progress:AchievementProgressSummary):CareerRoadNode[]=>{
 const nodes=progress.songs.map(song=>{
  const entry=SONG_STORE_CATALOG.find(item=>item.songId===song.songId);
  const price=entry?.price??0;
  const masteryCount=(song.firstClear?1:0)+song.sRanks+song.fullCombos;
  return{
   song,
   goal:nextCareerGoalForSong(song,price),
   masteryCount,
   masteryTotal:7,
   masteryPercent:masteryCount/7*100,
   current:false,
   price
  };
 });
 const nextIndex=nodes.findIndex(node=>node.goal.kind!=='mastered');
 if(nextIndex>=0)nodes[nextIndex]={...nodes[nextIndex],current:true};
 else if(nodes.length)nodes[nodes.length-1]={...nodes[nodes.length-1],current:true};
 return nodes;
};
