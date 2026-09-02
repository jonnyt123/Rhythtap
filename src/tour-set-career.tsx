import React,{useEffect,useMemo,useState} from 'react';
import {ArrowLeft,Check,Crown,Lock,Music2,Play,Star,Trophy} from 'lucide-react';
import {SUPABASE_ANON_KEY,SUPABASE_ESM,SUPABASE_URL} from './multiplayer-common';
import './tour-set-career.css';

export type TourDifficulty='EASY'|'NORMAL'|'HARD';
export type TourSong={id:string,title:string,artist:string,unlockLevel:number};
export type TourSetRun={gigId:string,slot:number};

type SetSong={songId:string,difficulty:TourDifficulty};
type TourSet={id:string,venue:string,city:string,subtitle:string,reward:string,songs:[SetSong,SetSong,SetSong],headliner?:boolean};
type TourProgress={performanceId:string,gigId:string,slot:number,stars:number,bestScore:number,bestAccuracy:number,bestDifficulty:TourDifficulty};
type SupabaseClient=any;

const TOUR_KEY='rhythtap-tour-set-progress-v2';
const HEADLINER_STAR_GATE=30;
const HEADLINER_FINAL_ACCURACY=85;
const MAX_STARS=72;

const tourSets:TourSet[]=[
 {id:'basement',venue:'BASEMENT SHOW',city:'OPENING NIGHT',subtitle:'PROVE YOU CAN FINISH A SET',reward:'UNLOCK: SKATEPARK SET',songs:[{songId:'sickness',difficulty:'EASY'},{songId:'never-left',difficulty:'EASY'},{songId:'kryptonite',difficulty:'EASY'}]},
 {id:'skatepark',venue:'SKATEPARK SET',city:'FIRST FOLLOWING',subtitle:'THREE SONGS. NO WALK-OFFS.',reward:'UNLOCK: CLUB STAGE',songs:[{songId:'never-left',difficulty:'EASY'},{songId:'fly-eagle',difficulty:'EASY'},{songId:'sickness',difficulty:'NORMAL'}]},
 {id:'club',venue:'CLUB STAGE',city:'PACKED HOUSE',subtitle:'THE SETLIST STARTS PUSHING BACK',reward:'UNLOCK: THEATRE NIGHT',songs:[{songId:'kryptonite',difficulty:'NORMAL'},{songId:'crazy-train',difficulty:'EASY'},{songId:'never-left',difficulty:'NORMAL'}]},
 {id:'theatre',venue:'THEATRE NIGHT',city:'THE SLOW SET',subtitle:'CONTROL MATTERS MORE THAN SPEED',reward:'UNLOCK: ARENA SUPPORT',songs:[{songId:'my-immortal',difficulty:'NORMAL'},{songId:'kryptonite',difficulty:'NORMAL'},{songId:'crazy-train',difficulty:'NORMAL'}]},
 {id:'arena',venue:'ARENA SUPPORT',city:'BIG STAGE',subtitle:'KEEP THE SET CLEAN UNDER PRESSURE',reward:'UNLOCK: MIDNIGHT FEST',songs:[{songId:'crazy-train',difficulty:'NORMAL'},{songId:'fly-eagle',difficulty:'NORMAL'},{songId:'sickness',difficulty:'HARD'}]},
 {id:'midnight',venue:'MIDNIGHT FEST',city:'LOUDER CROWD',subtitle:'THE EASY PART OF TOUR IS OVER',reward:'UNLOCK: UNDERGROUND HEADLINE',songs:[{songId:'fly-eagle',difficulty:'NORMAL'},{songId:'kill-you',difficulty:'NORMAL'},{songId:'my-immortal',difficulty:'HARD'}]},
 {id:'underground',venue:'UNDERGROUND HEADLINE',city:'NO WARMUP',subtitle:'THREE HARD CHARTS TO EARN THE BILLING',reward:'HEADLINER GATE OPENS AT 30 STARS',songs:[{songId:'kill-you',difficulty:'HARD'},{songId:'sickness',difficulty:'HARD'},{songId:'crazy-train',difficulty:'HARD'}]},
 {id:'headliner',venue:'FINAL HEADLINER',city:'TOUR FINALE',subtitle:'ONE LAST THREE-SONG SET. ALL HARD.',reward:'RHYTHTAP TOUR COMPLETE',headliner:true,songs:[{songId:'kryptonite',difficulty:'HARD'},{songId:'kill-you',difficulty:'HARD'},{songId:'through-fire-flames',difficulty:'HARD'}]},
];

let clientPromise:Promise<SupabaseClient>|null=null;
const getClient=()=>{if(clientPromise)return clientPromise;clientPromise=(async()=>{const importer=new Function('url','return import(url)') as (url:string)=>Promise<any>;const module=await importer(SUPABASE_ESM);return module.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'rhythtap-account-auth'}})})();return clientPromise};
const storageKey=(userId:string|null)=>`${TOUR_KEY}:${userId||'guest'}`;
const performanceId=(gigId:string,slot:number)=>`tourset:${gigId}:${slot}`;
const starsFor=(accuracy:number)=>accuracy>=95?3:accuracy>=85?2:accuracy>=70?1:0;
const difficultyRank=(value:TourDifficulty)=>value==='EASY'?0:value==='NORMAL'?1:2;
const parsePerformanceId=(value:string)=>{const match=/^tourset:([^:]+):([0-2])$/.exec(value);return match?{gigId:match[1],slot:Number(match[2])}:null};
const requiredStarsFor=(set:TourSet,slot:number)=>set.headliner&&slot===set.songs.length-1?2:1;

const readLocal=(userId:string|null):TourProgress[]=>{try{const value=JSON.parse(localStorage.getItem(storageKey(userId))||'[]');return Array.isArray(value)?value:[]}catch{return[]}};
const saveLocal=(userId:string|null,rows:TourProgress[])=>localStorage.setItem(storageKey(userId),JSON.stringify(rows));
const mergeProgress=(left:TourProgress[],right:TourProgress[])=>{
 const map=new Map<string,TourProgress>();
 for(const row of [...left,...right]){const current=map.get(row.performanceId);if(!current){map.set(row.performanceId,row);continue}map.set(row.performanceId,{...current,stars:Math.max(current.stars,row.stars),bestScore:Math.max(current.bestScore,row.bestScore),bestAccuracy:Math.max(current.bestAccuracy,row.bestAccuracy),bestDifficulty:difficultyRank(row.bestDifficulty)>=difficultyRank(current.bestDifficulty)?row.bestDifficulty:current.bestDifficulty})}
 return [...map.values()];
};
const cloudRow=(row:any):TourProgress|null=>{const parsed=parsePerformanceId(String(row.gig_id||''));if(!parsed)return null;return{performanceId:String(row.gig_id),gigId:parsed.gigId,slot:parsed.slot,stars:Number(row.stars)||0,bestScore:Number(row.best_score)||0,bestAccuracy:Number(row.best_accuracy)||0,bestDifficulty:String(row.best_difficulty||'EASY') as TourDifficulty}};

export async function recordTourSetResult(userId:string|null,run:TourSetRun|null,score:number,accuracy:number,difficulty:TourDifficulty){
 if(!run)return;
 const id=performanceId(run.gigId,run.slot),stars=starsFor(accuracy),local=readLocal(userId),existing=local.find(row=>row.performanceId===id);
 const next:TourProgress={performanceId:id,gigId:run.gigId,slot:run.slot,stars:Math.max(stars,existing?.stars||0),bestScore:Math.max(score,existing?.bestScore||0),bestAccuracy:Math.max(accuracy,existing?.bestAccuracy||0),bestDifficulty:difficultyRank(difficulty)>=difficultyRank(existing?.bestDifficulty||'EASY')?difficulty:(existing?.bestDifficulty||'EASY')};
 saveLocal(userId,[...local.filter(row=>row.performanceId!==id),next]);
 if(!userId)return;
 try{
  const client=await getClient(),{data}=await client.from('player_tour_progress').select('*').eq('user_id',userId).eq('gig_id',id).maybeSingle(),cloud=data||{};
  await client.from('player_tour_progress').upsert({user_id:userId,gig_id:id,stars:Math.max(next.stars,Number(cloud.stars)||0),best_score:Math.max(next.bestScore,Number(cloud.best_score)||0),best_accuracy:Math.max(next.bestAccuracy,Number(cloud.best_accuracy)||0),best_difficulty:difficultyRank(next.bestDifficulty)>=difficultyRank((cloud.best_difficulty||'EASY') as TourDifficulty)?next.bestDifficulty:(cloud.best_difficulty||'EASY'),completed_at:next.stars>0?(cloud.completed_at||new Date().toISOString()):cloud.completed_at,updated_at:new Date().toISOString()});
 }catch(error){console.warn('[tour-set] cloud progress sync failed',error)}
}

export function tourSetPasses(run:TourSetRun,accuracy:number){
 return run.gigId==='headliner'&&run.slot===2?accuracy>=HEADLINER_FINAL_ACCURACY:accuracy>=70;
}

export function getNextTourSetRun(run:TourSetRun){
 const set=tourSets.find(item=>item.id===run.gigId);if(!set||run.slot>=set.songs.length-1)return null;
 const slot=run.slot+1,spec=set.songs[slot];return{songId:spec.songId,difficulty:spec.difficulty,run:{gigId:run.gigId,slot} as TourSetRun};
}

export function TourSetScreen({songs,profileLevel,userId,back,onPlay}:{songs:TourSong[],profileLevel:number,userId:string|null,back:()=>void,onPlay:(songId:string,difficulty:TourDifficulty,run:TourSetRun)=>void}){
 const[progress,setProgress]=useState<TourProgress[]>(()=>readLocal(userId)),[loading,setLoading]=useState(Boolean(userId));
 useEffect(()=>{let mounted=true;const local=readLocal(userId);setProgress(local);setLoading(Boolean(userId));(async()=>{if(!userId){setLoading(false);return}try{const client=await getClient(),{data}=await client.from('player_tour_progress').select('*').eq('user_id',userId).like('gig_id','tourset:%');if(!mounted)return;const cloud=(data||[]).map(cloudRow).filter(Boolean) as TourProgress[],merged=mergeProgress(local,cloud);setProgress(merged);saveLocal(userId,merged);const cloudMap=new Map(cloud.map(row=>[row.performanceId,row] as const)),stale=merged.filter(row=>{const current=cloudMap.get(row.performanceId);return!current||row.stars>current.stars||row.bestScore>current.bestScore||row.bestAccuracy>current.bestAccuracy||difficultyRank(row.bestDifficulty)>difficultyRank(current.bestDifficulty)});if(stale.length)await Promise.all(stale.map(row=>recordTourSetResult(userId,{gigId:row.gigId,slot:row.slot},row.bestScore,row.bestAccuracy,row.bestDifficulty)))}catch(error){console.warn('[tour-set] cloud load failed',error)}finally{if(mounted)setLoading(false)}})();return()=>{mounted=false}},[userId]);
 const songMap=useMemo(()=>new Map(songs.map(song=>[song.id,song])),[songs]),progressMap=useMemo(()=>new Map(progress.map(row=>[row.performanceId,row])),[progress]);
 const starsAt=(gigId:string,slot:number)=>progressMap.get(performanceId(gigId,slot))?.stars||0;
 const setComplete=(set:TourSet)=>set.songs.every((_,slot)=>starsAt(set.id,slot)>=requiredStarsFor(set,slot));
 const totalStars=tourSets.reduce((sum,set)=>sum+set.songs.reduce((setSum,_,slot)=>setSum+starsAt(set.id,slot),0),0),setsCleared=tourSets.filter(setComplete).length;
 const firstIncomplete=(set:TourSet)=>{const slot=set.songs.findIndex((_,index)=>starsAt(set.id,index)<requiredStarsFor(set,index));return slot<0?0:slot};
 const isUnlocked=(set:TourSet,index:number)=>{if(index===0)return true;const previousComplete=setComplete(tourSets[index-1]);if(!previousComplete)return false;if(set.headliner&&totalStars<HEADLINER_STAR_GATE)return false;return true};
 const startSlot=(set:TourSet,index:number,slot:number)=>{const spec=set.songs[slot],song=songMap.get(spec.songId);if(!song||!isUnlocked(set,index)||profileLevel<song.unlockLevel)return;onPlay(song.id,spec.difficulty,{gigId:set.id,slot})};
 return <section className="career-tour screen">
  <header className="career-header"><button className="career-back" onClick={back} aria-label="Back"><ArrowLeft/></button><div><small>STORY MODE</small><h1>RHYTHMTAP TOUR</h1></div><span className="career-cleared">{setsCleared}/8 SETS</span></header>
  <div className="career-wrap">
   <div className="career-hero"><div><small>CAREER PROGRESS</small><strong>{totalStars} <span>/ {MAX_STARS} STARS</span></strong><p>Every gig is a three-song set. Clear each song with at least 70% accuracy to advance. The final Headliner song requires 85%.</p><div className="career-star-key"><span><Star/>70% = 1</span><span><Star/>85% = 2</span><span><Star/>95% = 3</span></div></div><Trophy/></div>
   <div className="career-path">{tourSets.map((set,index)=>{const unlocked=isUnlocked(set,index),complete=setComplete(set),setStars=set.songs.reduce((sum,_,slot)=>sum+starsAt(set.id,slot),0),nextSlot=firstIncomplete(set),nextSpec=set.songs[complete?0:nextSlot],nextSong=songMap.get(nextSpec.songId),nextLevelReady=Boolean(nextSong&&profileLevel>=nextSong.unlockLevel);const gate=set.headliner&&!unlocked&&setComplete(tourSets[index-1])?`${HEADLINER_STAR_GATE-totalStars} MORE STARS TO HEADLINE`:`CLEAR ${index>0?tourSets[index-1].venue:'THIS SET'} TO ADVANCE`;return <article key={set.id} className={`career-gig${set.headliner?' headliner':''}${unlocked?'':' locked'}${complete?' complete':''}`}>
    <div className="career-gig-top"><div className="career-number">{complete?<Check/>:set.headliner?<Crown/>:unlocked?index+1:<Lock/>}</div><div className="career-title"><small>{set.city}</small><h2>{set.venue}</h2><p>{set.subtitle}</p></div><div className="career-set-stars"><strong>{setStars}/9</strong><span>SET STARS</span></div></div>
    <div className="career-setlist">{set.songs.map((spec,slot)=>{const song=songMap.get(spec.songId),stars=starsAt(set.id,slot),required=requiredStarsFor(set,slot),previousCleared=slot===0||starsAt(set.id,slot-1)>=requiredStarsFor(set,slot-1),levelReady=Boolean(song&&profileLevel>=song.unlockLevel),available=unlocked&&(complete||previousCleared)&&(slot<=nextSlot||stars>=required)&&levelReady,cleared=stars>=required,finalChallenge=Boolean(set.headliner&&slot===2);return <div className={`career-song${cleared?' cleared':''}${available?'':' unavailable'}${finalChallenge?' challenge':''}`} key={`${set.id}-${slot}`}><span className="career-song-index">{cleared?<Check/>:available?slot+1:<Lock/>}</span><div className="career-song-copy"><small>{finalChallenge?`HEADLINER CHALLENGE · ${HEADLINER_FINAL_ACCURACY}%+`:`SONG ${slot+1} · ${spec.difficulty}`}</small><strong>{song?.title||spec.songId}</strong><span>{song?`${song.artist}${levelReady?'':` · UNLOCKS LV ${song.unlockLevel}`}`:'TRACK UNAVAILABLE'}</span></div><div className="career-song-stars">{[1,2,3].map(value=><Star key={value} fill={stars>=value?'currentColor':'none'}/>)}</div><button disabled={!available||!song||loading} onClick={()=>startSlot(set,index,slot)} aria-label={`Play ${song?.title||spec.songId}`}><Play/></button></div>})}</div>
    <div className="career-gig-footer"><div>{complete?<><Check/><span><small>SET COMPLETE</small><strong>{set.reward}</strong></span></>:unlocked?<><Music2/><span><small>{nextSlot}/3 SONGS CLEARED</small><strong>{nextLevelReady?'FINISH ALL THREE TO ADVANCE':nextSong?`REACH LEVEL ${nextSong.unlockLevel} FOR NEXT SONG`:'NEXT TRACK UNAVAILABLE'}</strong></span></>:<><Lock/><span><small>LOCKED</small><strong>{gate}</strong></span></>}</div><button className="career-set-button" disabled={!unlocked||loading||!nextLevelReady} onClick={()=>startSlot(set,index,complete?0:nextSlot)}>{set.headliner?<Crown/>:<Play/>}{!nextLevelReady&&nextSong?`REACH LV ${nextSong.unlockLevel}`:complete?'REPLAY SET':nextSlot===0?(set.headliner?'TAKE THE STAGE':'START SET'):`CONTINUE · SONG ${nextSlot+1}`}</button></div>
   </article>})}</div>
   {setsCleared===tourSets.length&&<div className="career-finale"><Crown/><div><small>TOUR COMPLETE</small><h2>YOU MADE THE BILL.</h2><p>All eight sets are cleared. Chase 72/72 stars or take your scores into Ranked.</p></div></div>}
  </div>
 </section>;
}
