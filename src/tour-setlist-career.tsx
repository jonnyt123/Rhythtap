import React,{useEffect,useMemo,useState} from 'react';
import {ArrowLeft,Check,Crown,Lock,Play,Star,Trophy} from 'lucide-react';
import {SUPABASE_ANON_KEY,SUPABASE_ESM,SUPABASE_URL} from './multiplayer-common';
import './tour-setlist-career.css';

export type TourDifficulty='EASY'|'NORMAL'|'HARD';
export type TourSong={id:string,title:string,artist:string,unlockLevel:number};
export type TourSetlistStage={gigId:string,songId:string,difficulty:TourDifficulty,requiredStars:number,label:string};
export type TourSetlistRun={gigId:string,venueId:string,venueName:string,songIndex:number,setlist:TourSetlistStage[]};
type TourProgress={gigId:string,stars:number,bestScore:number,bestAccuracy:number,bestDifficulty:TourDifficulty};
type TourVenue={id:string,venue:string,city:string,eyebrow:string,setlist:TourSetlistStage[]};
type SupabaseClient=any;

const TOUR_KEY='rhythtap-tour-progress-v1';
const venues:TourVenue[]=[
 {id:'basement-set',venue:'BASEMENT SHOW',city:'OPENING NIGHT',eyebrow:'FIRST GIG',setlist:[
  {gigId:'tour-basement-1',songId:'sickness',difficulty:'EASY',requiredStars:1,label:'SET OPENER'},
  {gigId:'tour-basement-2',songId:'never-left',difficulty:'EASY',requiredStars:1,label:'SECOND SONG'},
  {gigId:'tour-basement-3',songId:'kryptonite',difficulty:'EASY',requiredStars:1,label:'SET CLOSER'},
 ]},
 {id:'club-set',venue:'CLUB CIRCUIT',city:'PACKED HOUSE',eyebrow:'BUILD A FOLLOWING',setlist:[
  {gigId:'tour-club-1',songId:'fly-eagle',difficulty:'EASY',requiredStars:1,label:'SET OPENER'},
  {gigId:'tour-club-2',songId:'my-immortal',difficulty:'NORMAL',requiredStars:1,label:'MID-SET'},
  {gigId:'tour-club-3',songId:'crazy-train',difficulty:'NORMAL',requiredStars:1,label:'SET CLOSER'},
 ]},
 {id:'theatre-set',venue:'THEATRE BREAKOUT',city:'SOLD OUT NIGHT',eyebrow:'MOVE UP THE BILL',setlist:[
  {gigId:'tour-theatre-1',songId:'never-left',difficulty:'NORMAL',requiredStars:1,label:'SET OPENER'},
  {gigId:'tour-theatre-2',songId:'kryptonite',difficulty:'NORMAL',requiredStars:1,label:'MID-SET'},
  {gigId:'tour-theatre-3',songId:'fly-eagle',difficulty:'NORMAL',requiredStars:1,label:'SET CLOSER'},
 ]},
 {id:'arena-set',venue:'ARENA SUPPORT',city:'BIG STAGE',eyebrow:'PROVE YOU BELONG',setlist:[
  {gigId:'tour-arena-1',songId:'sickness',difficulty:'NORMAL',requiredStars:1,label:'SET OPENER'},
  {gigId:'tour-arena-2',songId:'kill-you',difficulty:'HARD',requiredStars:1,label:'PRESSURE SONG'},
  {gigId:'tour-arena-3',songId:'crazy-train',difficulty:'HARD',requiredStars:1,label:'SET CLOSER'},
 ]},
 {id:'headliner-set',venue:'FINAL HEADLINER',city:'TOUR FINALE',eyebrow:'YOUR NAME ON TOP',setlist:[
  {gigId:'tour-headliner-1',songId:'my-immortal',difficulty:'HARD',requiredStars:1,label:'HEADLINER OPENER'},
  {gigId:'tour-headliner-2',songId:'kill-you',difficulty:'HARD',requiredStars:1,label:'MAIN SET'},
  {gigId:'tour-headliner-3',songId:'through-fire-flames',difficulty:'HARD',requiredStars:2,label:'HEADLINER CHALLENGE'},
 ]},
];
const legacyStageMap:Record<string,string>={basement:'tour-basement-1',skatepark:'tour-basement-2',club:'tour-basement-3',midnight:'tour-club-1',theatre:'tour-club-2',arena:'tour-club-3',underground:'tour-arena-2',headliner:'tour-headliner-3'};
const currentStageIds=new Set(venues.flatMap(venue=>venue.setlist.map(stage=>stage.gigId)));
const diffRank=(difficulty:TourDifficulty)=>difficulty==='EASY'?0:difficulty==='NORMAL'?1:2;
const starsFor=(accuracy:number)=>accuracy>=95?3:accuracy>=85?2:accuracy>=70?1:0;
const storageKey=(userId:string|null)=>`${TOUR_KEY}:${userId||'guest'}`;

let clientPromise:Promise<SupabaseClient>|null=null;
const getClient=()=>{if(clientPromise)return clientPromise;clientPromise=(async()=>{const importer=new Function('url','return import(url)') as (url:string)=>Promise<any>;const module=await importer(SUPABASE_ESM);return module.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'rhythtap-account-auth'}})})();return clientPromise};

const mergeRows=(rows:TourProgress[])=>{
 const byId=new Map<string,TourProgress>();
 rows.forEach(row=>{const id=legacyStageMap[row.gigId]||row.gigId;if(!currentStageIds.has(id))return;const current=byId.get(id);if(!current){byId.set(id,{...row,gigId:id});return}byId.set(id,{gigId:id,stars:Math.max(current.stars,row.stars),bestScore:Math.max(current.bestScore,row.bestScore),bestAccuracy:Math.max(current.bestAccuracy,row.bestAccuracy),bestDifficulty:diffRank(row.bestDifficulty)>=diffRank(current.bestDifficulty)?row.bestDifficulty:current.bestDifficulty})});
 return [...byId.values()];
};
const normalizeRows=(rows:any[]):TourProgress[]=>mergeRows(rows.map(row=>({gigId:String(row.gigId??row.gig_id??''),stars:Number(row.stars)||0,bestScore:Number(row.bestScore??row.best_score)||0,bestAccuracy:Number(row.bestAccuracy??row.best_accuracy)||0,bestDifficulty:String(row.bestDifficulty??row.best_difficulty??'EASY') as TourDifficulty})));
const readLocal=(userId:string|null):TourProgress[]=>{try{const scoped=JSON.parse(localStorage.getItem(storageKey(userId))||'[]');const legacy=userId?[]:JSON.parse(localStorage.getItem(TOUR_KEY)||'[]');return normalizeRows([...(Array.isArray(scoped)?scoped:[]),...(Array.isArray(legacy)?legacy:[])])}catch{return[]}};
const saveLocal=(userId:string|null,rows:TourProgress[])=>localStorage.setItem(storageKey(userId),JSON.stringify(mergeRows(rows)));

export async function recordTourSetlistResult(userId:string|null,run:TourSetlistRun|null,score:number,accuracy:number,difficulty:TourDifficulty){
 if(!run)return;
 const stars=starsFor(accuracy),local=readLocal(userId),existing=local.find(row=>row.gigId===run.gigId),next:TourProgress={gigId:run.gigId,stars:Math.max(stars,existing?.stars||0),bestScore:Math.max(score,existing?.bestScore||0),bestAccuracy:Math.max(accuracy,existing?.bestAccuracy||0),bestDifficulty:diffRank(difficulty)>=diffRank(existing?.bestDifficulty||'EASY')?difficulty:(existing?.bestDifficulty||'EASY')};
 saveLocal(userId,[...local.filter(row=>row.gigId!==run.gigId),next]);
 if(!userId)return;
 try{const client=await getClient();const{data}=await client.from('player_tour_progress').select('*').eq('user_id',userId).eq('gig_id',run.gigId).maybeSingle();const cloud=data||{};await client.from('player_tour_progress').upsert({user_id:userId,gig_id:run.gigId,stars:Math.max(stars,Number(cloud.stars)||0),best_score:Math.max(score,Number(cloud.best_score)||0),best_accuracy:Math.max(accuracy,Number(cloud.best_accuracy)||0),best_difficulty:diffRank(difficulty)>=diffRank((cloud.best_difficulty||'EASY') as TourDifficulty)?difficulty:(cloud.best_difficulty||'EASY'),completed_at:stars>0?(cloud.completed_at||new Date().toISOString()):cloud.completed_at,updated_at:new Date().toISOString()})}catch(error){console.warn('[tour-setlist] cloud progress sync failed',error)}
}

export function TourSetlistScreen({songs,profileLevel,userId,back,onPlay}:{songs:TourSong[],profileLevel:number,userId:string|null,back:()=>void,onPlay:(songId:string,difficulty:TourDifficulty,run:TourSetlistRun)=>void}){
 const[progress,setProgress]=useState<TourProgress[]>(()=>readLocal(userId)),[loading,setLoading]=useState(Boolean(userId));
 useEffect(()=>{let mounted=true;setProgress(readLocal(userId));setLoading(Boolean(userId));(async()=>{if(!userId){setLoading(false);return}try{const client=await getClient(),{data,error}=await client.from('player_tour_progress').select('*').eq('user_id',userId);if(error)throw error;if(!mounted)return;const merged=mergeRows([...readLocal(userId),...normalizeRows(data||[])]);setProgress(merged);saveLocal(userId,merged)}catch(error){console.warn('[tour-setlist] cloud progress load failed',error)}finally{if(mounted)setLoading(false)}})();return()=>{mounted=false}},[userId]);
 const songMap=useMemo(()=>new Map(songs.map(song=>[song.id,song])),[songs]),progressMap=useMemo(()=>new Map(progress.map(row=>[row.gigId,row])),[progress]);
 const stageCleared=(stage:TourSetlistStage)=>(progressMap.get(stage.gigId)?.stars||0)>=stage.requiredStars;
 const venueComplete=(venue:TourVenue)=>venue.setlist.every(stageCleared);
 const venueStars=(venue:TourVenue)=>venue.setlist.reduce((sum,stage)=>sum+Math.min(3,progressMap.get(stage.gigId)?.stars||0),0);
 const totalStars=venues.reduce((sum,venue)=>sum+venueStars(venue),0),completedVenues=venues.filter(venueComplete).length,tourComplete=completedVenues===venues.length;
 const launchVenue=(venue:TourVenue)=>{const complete=venueComplete(venue),firstIncomplete=complete?0:Math.max(0,venue.setlist.findIndex(stage=>!stageCleared(stage))),setlist=venue.setlist.slice(firstIncomplete);if(!setlist.length)return;const first=setlist[0],song=songMap.get(first.songId);if(!song)return;onPlay(first.songId,first.difficulty,{gigId:first.gigId,venueId:venue.id,venueName:venue.venue,songIndex:0,setlist})};
 return <section className="career-screen screen"><header className="career-top"><button className="icon" onClick={back} aria-label="Back"><ArrowLeft/></button><div><small>STORY MODE</small><h2>RHYTHMTAP TOUR</h2></div><span className="career-level">LV {profileLevel}</span></header><div className="career-wrap">
  <div className={'career-hero '+(tourComplete?'complete':'')}><div><small>{tourComplete?'TOUR COMPLETE':'CAREER PROGRESS'}</small><strong>{totalStars} <span>/ {venues.length*9} STARS</span></strong><p>{tourComplete?'You cleared every set and survived the headliner challenge.':`${completedVenues} / ${venues.length} gigs cleared · finish every song in a set to unlock the next venue.`}</p></div>{tourComplete?<Crown/>:<Trophy/>}</div>
  {venues.map((venue,index)=>{const unlocked=index===0||venues.slice(0,index).every(venueComplete),complete=venueComplete(venue),stars=venueStars(venue),firstIncomplete=venue.setlist.findIndex(stage=>!stageCleared(stage)),available=venue.setlist.every(stage=>songMap.has(stage.songId));return <article key={venue.id} className={'career-venue '+(unlocked?'':'locked')+(complete?' cleared':'')+(index===venues.length-1?' headliner':'')}>
   <div className="career-venue-head"><div className="career-number">{complete?<Check/>:unlocked?String(index+1).padStart(2,'0'):<Lock/>}</div><div><small>{venue.eyebrow}</small><h3>{venue.venue}</h3><span>{venue.city}</span></div><div className="career-gig-stars"><strong>{stars}/9</strong><small>GIG STARS</small></div></div>
   <div className="career-setlist">{venue.setlist.map((stage,stageIndex)=>{const song=songMap.get(stage.songId),row=progressMap.get(stage.gigId),cleared=stageCleared(stage),isChallenge=stage.requiredStars>1;return <div key={stage.gigId} className={'career-song '+(cleared?'cleared':'')+(isChallenge?' challenge':'')}><div className="career-song-index">{cleared?<Check/>:stageIndex+1}</div><div className="career-song-copy"><small>{isChallenge?'HEADLINER CHALLENGE':stage.label}</small><strong>{song?.title||stage.songId}</strong><span>{song?.artist||''}</span></div><div className="career-song-meta"><b>{stage.difficulty}</b>{isChallenge&&<em>NEED {stage.requiredStars}★</em>}<div>{[1,2,3].map(star=><Star key={star} fill={(row?.stars||0)>=star?'currentColor':'none'}/>)}</div></div></div>})}</div>
   <div className="career-venue-foot"><div><small>{complete?'SET CLEARED':unlocked?firstIncomplete<=0?'START AT SONG 1':`CONTINUE AT SONG ${firstIncomplete+1}`:'LOCKED'}</small><strong>{complete?'Replay the full three-song gig':unlocked?'Clear all three songs to advance':'Finish the previous gig first'}</strong></div><button className="primary" disabled={!unlocked||!available||loading} onClick={()=>launchVenue(venue)}>{index===venues.length-1?<Crown/>:<Play fill="currentColor"/>} {complete?'REPLAY SET':firstIncomplete>0?'CONTINUE SET':index===venues.length-1?'START HEADLINER':'START SET'}</button></div>
  </article>})}
 </div></section>;
}
