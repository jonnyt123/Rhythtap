import {makeWeightedBeatChart as makeV4Beat,makeWeightedOnsetChart as makeV4Onset,type WeightedDifficulty,type WeightedNote,type WeightedOnsetEvent} from './weighted-chart-v4.ts';

const HARD_MIN_EVENT_GAP=105;
const HARD_MAX_NOTES_PER_SECOND=7;
const HARD_MAX_CHORD=2;

export const capHardDensity=(notes:WeightedNote[],difficulty:WeightedDifficulty):WeightedNote[]=>{
 if(difficulty!=='HARD')return notes.map((note,index)=>({...note,id:index}));
 const groups=new Map<number,WeightedNote[]>();
 for(const note of [...notes].sort((a,b)=>a.time-b.time||a.lane-b.lane)){const group=groups.get(note.time)||[];group.push(note);groups.set(note.time,group)}
 const out:WeightedNote[]=[],recentTimes:number[]=[];let lastEvent=-Infinity;
 for(const [time,group] of groups){
  if(time-lastEvent<HARD_MIN_EVENT_GAP)continue;
  while(recentTimes.length&&recentTimes[0]<=time-1000)recentTimes.shift();
  const room=HARD_MAX_NOTES_PER_SECOND-recentTimes.length;
  if(room<=0)continue;
  const chosen=group.slice(0,Math.min(HARD_MAX_CHORD,room));
  if(!chosen.length)continue;
  out.push(...chosen);for(let i=0;i<chosen.length;i++)recentTimes.push(time);lastEvent=time;
 }
 return out.map((note,index)=>({...note,id:index}));
};

export const makeWeightedBeatChart=(bpm:number,offset:number,duration:number,difficulty:WeightedDifficulty,seed:number):WeightedNote[]=>capHardDensity(makeV4Beat(bpm,offset,duration,difficulty,seed),difficulty);
export const makeWeightedOnsetChart=(events:readonly WeightedOnsetEvent[],difficulty:WeightedDifficulty):WeightedNote[]=>capHardDensity(makeV4Onset(events,difficulty),difficulty);
export type {WeightedDifficulty,WeightedNote,WeightedOnsetEvent};
