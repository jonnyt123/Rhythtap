import {makeWeightedBeatChart as makeV3Beat,makeWeightedOnsetChart as makeV3Onset,type WeightedDifficulty,type WeightedNote,type WeightedOnsetEvent} from './weighted-chart-v3.ts';

const MIN_LANE_GAP:Record<WeightedDifficulty,number>={EASY:180,NORMAL:115,HARD:70};
const HOLD_RELEASE_GRACE=100;

export const sanitizeWeightedChart=(notes:WeightedNote[],difficulty:WeightedDifficulty):WeightedNote[]=>{
 const minGap=MIN_LANE_GAP[difficulty],lastAt=[-Infinity,-Infinity,-Infinity],blockedUntil=[-Infinity,-Infinity,-Infinity],out:WeightedNote[]=[];
 for(const note of [...notes].sort((a,b)=>a.time-b.time||a.lane-b.lane)){
  const lane=Math.max(0,Math.min(2,note.lane|0));
  if(note.time-lastAt[lane]<minGap)continue;
  if(note.time<blockedUntil[lane])continue;
  const clean:{id:number,time:number,lane:number,duration?:number}={id:0,time:note.time,lane};
  if(note.duration&&note.duration>0)clean.duration=note.duration;
  out.push(clean);lastAt[lane]=note.time;
  if(clean.duration)blockedUntil[lane]=clean.time+clean.duration-HOLD_RELEASE_GRACE;
 }
 return out.map((note,index)=>({...note,id:index}));
};

export const makeWeightedBeatChart=(bpm:number,offset:number,duration:number,difficulty:WeightedDifficulty,seed:number):WeightedNote[]=>sanitizeWeightedChart(makeV3Beat(bpm,offset,duration,difficulty,seed),difficulty);
export const makeWeightedOnsetChart=(events:readonly WeightedOnsetEvent[],difficulty:WeightedDifficulty):WeightedNote[]=>sanitizeWeightedChart(makeV3Onset(events,difficulty),difficulty);
export type {WeightedDifficulty,WeightedNote,WeightedOnsetEvent};
