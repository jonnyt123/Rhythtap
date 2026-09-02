import type {Plugin} from 'vite';

const replaceRequired=(source:string,label:string,before:string,after:string)=>{
 if(!source.includes(before))throw new Error(`[tour-setlist] Unable to patch ${label}; transformed layout changed.`);
 return source.replace(before,after);
};

const replaceBetween=(source:string,label:string,start:string,end:string,replacement:string)=>{
 const from=source.indexOf(start),to=source.indexOf(end,from+start.length);
 if(from<0||to<0)throw new Error(`[tour-setlist] Unable to patch ${label}; transformed layout changed.`);
 return source.slice(0,from)+replacement+source.slice(to);
};

const tourTypesAndData=`export type TourRun={gigId:string,songIndex:number,setStars:number,setScore:number,accuracyTotal:number,completedSongs:number,challengeFailed?:boolean};
type TourProgress={gigId:string,stars:number,setStars:number,bestScore:number,bestAccuracy:number,bestDifficulty:TourDifficulty,completed:boolean};
type TourTrack={songId:string,difficulty:TourDifficulty,label?:string};
type TourGig={id:string,venue:string,city:string,need:number,set:TourTrack[],bossAccuracy?:number};`;

const tourData=`const tours:TourGig[]=[
 {id:'basement',venue:'BASEMENT SHOW',city:'OPENING NIGHT',need:0,set:[{songId:'sickness',difficulty:'EASY'},{songId:'never-left',difficulty:'EASY'},{songId:'kryptonite',difficulty:'EASY',label:'SET CLOSER'}]},
 {id:'skatepark',venue:'SKATEPARK SET',city:'FIRST FOLLOWING',need:4,set:[{songId:'never-left',difficulty:'EASY'},{songId:'fly-eagle',difficulty:'EASY'},{songId:'sickness',difficulty:'NORMAL',label:'SET CLOSER'}]},
 {id:'club',venue:'CLUB STAGE',city:'PACKED HOUSE',need:9,set:[{songId:'kryptonite',difficulty:'NORMAL'},{songId:'crazy-train',difficulty:'EASY'},{songId:'never-left',difficulty:'NORMAL',label:'SET CLOSER'}]},
 {id:'theatre',venue:'THEATRE NIGHT',city:'THE SLOW SET',need:15,set:[{songId:'my-immortal',difficulty:'NORMAL'},{songId:'kryptonite',difficulty:'NORMAL'},{songId:'crazy-train',difficulty:'NORMAL',label:'SET CLOSER'}]},
 {id:'arena',venue:'ARENA SUPPORT',city:'BIG STAGE',need:22,set:[{songId:'crazy-train',difficulty:'NORMAL'},{songId:'sickness',difficulty:'NORMAL'},{songId:'fly-eagle',difficulty:'NORMAL',label:'SET CLOSER'}]},
 {id:'midnight',venue:'MIDNIGHT FEST',city:'LOUDER CROWD',need:30,set:[{songId:'fly-eagle',difficulty:'NORMAL'},{songId:'kill-you',difficulty:'NORMAL'},{songId:'crazy-train',difficulty:'HARD',label:'SET CLOSER'}]},
 {id:'underground',venue:'UNDERGROUND HEADLINE',city:'NO WARMUP',need:39,set:[{songId:'kill-you',difficulty:'HARD'},{songId:'sickness',difficulty:'HARD'},{songId:'kryptonite',difficulty:'HARD',label:'SET CLOSER'}]},
 {id:'headliner',venue:'FINAL HEADLINER',city:'TOUR FINALE',need:49,bossAccuracy:85,set:[{songId:'crazy-train',difficulty:'HARD'},{songId:'kill-you',difficulty:'HARD'},{songId:'through-fire-flames',difficulty:'HARD',label:'HEADLINER CHALLENGE'}]},
];
const diffRank=(d:TourDifficulty)=>d==='EASY'?0:d==='NORMAL'?1:2;
const starsFor=(accuracy:number)=>accuracy>=95?3:accuracy>=85?2:accuracy>=70?1:0;
const normalizeTourProgress=(rows:any[]):TourProgress[]=>rows.map((r:any)=>({gigId:String(r.gigId||r.gig_id||''),stars:Number(r.stars)||0,setStars:Number(r.setStars??r.set_stars??((Number(r.stars)||0)*3))||0,bestScore:Number(r.bestScore??r.best_score)||0,bestAccuracy:Number(r.bestAccuracy??r.best_accuracy)||0,bestDifficulty:String(r.bestDifficulty??r.best_difficulty??'EASY') as TourDifficulty,completed:Boolean(r.completed??r.completed_at??((Number(r.stars)||0)>0))})).filter(r=>r.gigId);
export const getTourSongForRun=(run:TourRun|null)=>{if(!run)return null;const gig=tours.find(g=>g.id===run.gigId);return gig?.set[run.songIndex]||null};
export const isTourSetComplete=(run:TourRun|null)=>{if(!run||run.challengeFailed)return false;const gig=tours.find(g=>g.id===run.gigId);return Boolean(gig&&run.songIndex>=gig.set.length)};
export const advanceTourRun=(run:TourRun,score:number,accuracy:number):TourRun=>{const gig=tours.find(g=>g.id===run.gigId);if(!gig)return run;const isFinal=run.songIndex===gig.set.length-1;if(isFinal&&gig.bossAccuracy&&accuracy<gig.bossAccuracy)return{...run,challengeFailed:true};return{...run,songIndex:run.songIndex+1,setStars:Math.min(9,run.setStars+starsFor(accuracy)),setScore:run.setScore+score,accuracyTotal:run.accuracyTotal+accuracy,completedSongs:run.completedSongs+1,challengeFailed:false}};
`;

const recordTourResult=`export async function recordTourResult(userId:string|null,run:TourRun|null){
 if(!run||!isTourSetComplete(run))return;
 const gig=tours.find(g=>g.id===run.gigId);if(!gig)return;
 const setStars=Math.max(0,Math.min(9,run.setStars)),avgAccuracy=run.completedSongs?run.accuracyTotal/run.completedSongs:0,gigStars=starsFor(avgAccuracy),bestDifficulty=gig.set.reduce<TourDifficulty>((best,track)=>diffRank(track.difficulty)>diffRank(best)?track.difficulty:best,'EASY');
 const local=normalizeTourProgress(readLocalTour(userId)),existing=local.find(x=>x.gigId===run.gigId),next:TourProgress={gigId:run.gigId,stars:Math.max(gigStars,existing?.stars||0),setStars:Math.max(setStars,existing?.setStars||0),bestScore:Math.max(run.setScore,existing?.bestScore||0),bestAccuracy:Math.max(avgAccuracy,existing?.bestAccuracy||0),bestDifficulty:diffRank(bestDifficulty)>=diffRank(existing?.bestDifficulty||'EASY')?bestDifficulty:(existing?.bestDifficulty||'EASY'),completed:true};
 saveLocalTour(userId,[...local.filter(x=>x.gigId!==run.gigId),next]);
 if(!userId)return;
 try{const client=await getAppClient();const{data}=await client.from('player_tour_progress').select('*').eq('user_id',userId).eq('gig_id',run.gigId).maybeSingle();const cloud=data||{};await client.from('player_tour_progress').upsert({user_id:userId,gig_id:run.gigId,stars:Math.max(gigStars,Number(cloud.stars)||0),set_stars:Math.max(setStars,Number(cloud.set_stars)||0),best_score:Math.max(run.setScore,Number(cloud.best_score)||0),best_accuracy:Math.max(avgAccuracy,Number(cloud.best_accuracy)||0),best_difficulty:diffRank(bestDifficulty)>=diffRank((cloud.best_difficulty||'EASY') as TourDifficulty)?bestDifficulty:cloud.best_difficulty||'EASY',completed_at:cloud.completed_at||new Date().toISOString(),updated_at:new Date().toISOString()})}catch(e){console.warn('[tour] cloud set progress sync failed',e)}
}

`;

const tourScreen=`export function TourScreen({songs,profileLevel,userId,back,onPlay}:{songs:TourSong[],profileLevel:number,userId:string|null,back:()=>void,onPlay:(songId:string,difficulty:TourDifficulty,run:TourRun)=>void}){
 const[progress,setProgress]=useState<TourProgress[]>(()=>normalizeTourProgress(readLocalTour(userId))),[loading,setLoading]=useState(Boolean(userId));
 useEffect(()=>{let mounted=true;setProgress(normalizeTourProgress(readLocalTour(userId)));setLoading(Boolean(userId));(async()=>{if(!userId){setLoading(false);return}try{const client=await getAppClient(),{data}=await client.from('player_tour_progress').select('*').eq('user_id',userId);if(!mounted)return;const cloud=normalizeTourProgress(data||[]);setProgress(cloud);saveLocalTour(userId,cloud)}finally{if(mounted)setLoading(false)}})();return()=>{mounted=false}},[userId]);
 const total=progress.reduce((n,p)=>n+p.setStars,0),songMap=useMemo(()=>new Map(songs.map(s=>[s.id,s])),[songs]),tourComplete=Boolean(progress.find(p=>p.gigId==='headliner'&&p.completed));
 return <section className="tsr-screen screen"><Header eyebrow="CAREER" title="RHYTHMTAP TOUR" back={back}/><div className="tsr-wrap"><div className="tour-hero"><div><small>{tourComplete?'TOUR COMPLETE':'TOUR SET STARS'}</small><strong>{total} / {tours.length*9}</strong><p>Each venue is a 3-song set. Finish the entire set to unlock the next stop. Every song awards up to 3 stars.</p></div><Trophy/></div><div className="tour-line">{tours.map((gig,index)=>{const setSongs=gig.set.map(track=>songMap.get(track.songId)),p=progress.find(x=>x.gigId===gig.id),previousComplete=index===0||Boolean(progress.find(x=>x.gigId===tours[index-1].id)?.completed),levelReady=setSongs.every(song=>profileLevel>=(song?.unlockLevel||1)),songsReady=setSongs.every(Boolean),unlocked=previousComplete&&total>=gig.need&&levelReady,complete=Boolean(p?.completed);return <article key={gig.id} className={'tour-stop tour-set-stop '+(unlocked?'':'locked')+(gig.bossAccuracy?' tour-boss':'')}><div className="tour-index">{complete?<Check/>:unlocked?index+1:<Lock/>}</div><div className="tour-copy tour-set-copy"><small>{gig.city}</small><h3>{gig.venue}</h3><div className="tour-set-meta"><strong>3-SONG SET</strong><span>{complete?'CLEARED':gig.bossAccuracy?`FINAL SONG · ${gig.bossAccuracy}% REQUIRED`:'PLAY ALL 3 TO ADVANCE'}</span></div><div className="tour-setlist">{gig.set.map((track,trackIndex)=>{const song=setSongs[trackIndex];return <div className={'tour-track-row '+(track.label==='HEADLINER CHALLENGE'?'challenge':'')} key={track.songId+'-'+trackIndex}><b>{trackIndex+1}</b><span><strong>{song?.title||track.songId}</strong><small>{song?.artist||'TRACK'} · {track.difficulty}{track.label?` · ${track.label}`:''}</small></span></div>})}</div><div className="tour-stars set-stars" aria-label={`${p?.setStars||0} of 9 set stars`}>{Array.from({length:9},(_,i)=><Star key={i} fill={(p?.setStars||0)>i?'currentColor':'none'}/>)}</div></div><div className="tour-action tour-set-action"><small>{unlocked?(complete?'SET CLEARED':gig.bossAccuracy?'HEADLINER SET':`${gig.need} STAR GATE`):!previousComplete?'CLEAR PREVIOUS SET':total<gig.need?`NEED ${gig.need} STARS`:!levelReady?'LEVEL UP TO UNLOCK':'TRACK UNAVAILABLE'}</small><button className="primary compact" disabled={!unlocked||!songsReady||loading} onClick={()=>{const first=gig.set[0],song=setSongs[0];if(!song)return;onPlay(first.songId,first.difficulty,{gigId:gig.id,songIndex:0,setStars:0,setScore:0,accuracyTotal:0,completedSongs:0})}}><Play/> {complete?'REPLAY SET':'START SET'}</button></div></article>})}</div></div></section>;
}

`;

const css=`
/* Tour setlist career expansion */
.tour-set-stop{align-items:stretch}.tour-set-copy{min-width:0}.tour-set-meta{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:.45rem 0 .7rem}.tour-set-meta strong{font-size:.72rem;letter-spacing:.12em}.tour-set-meta span{font-size:.68rem;opacity:.7}.tour-setlist{display:grid;gap:6px;margin:.6rem 0}.tour-track-row{display:grid;grid-template-columns:28px minmax(0,1fr);gap:8px;align-items:center;padding:8px 10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);border-radius:9px}.tour-track-row>b{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,.08);font-size:.72rem}.tour-track-row span{min-width:0}.tour-track-row span strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.82rem}.tour-track-row span small{display:block;margin-top:2px;font-size:.62rem;letter-spacing:.05em;opacity:.62}.tour-track-row.challenge{border-color:rgba(255,80,110,.38);background:rgba(255,55,90,.07)}.tour-track-row.challenge>b{background:rgba(255,55,90,.18)}.tour-stars.set-stars{display:grid;grid-template-columns:repeat(9,16px);gap:3px;margin-top:10px}.tour-stars.set-stars svg{width:15px;height:15px}.tour-set-action{min-width:128px}.tour-boss{box-shadow:inset 0 0 0 1px rgba(255,60,100,.16)}.tour-result-banner{margin:0 auto 14px;max-width:420px;padding:10px 14px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(255,255,255,.04);text-align:center;font-size:.76rem;font-weight:800;letter-spacing:.08em}.tour-result-banner.challenge{border-color:rgba(255,70,100,.42);background:rgba(255,55,90,.09)}
@media(max-width:640px){.tour-set-stop{grid-template-columns:42px minmax(0,1fr)}.tour-set-action{grid-column:2;width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px}.tour-set-action button{min-width:128px}.tour-stars.set-stars{grid-template-columns:repeat(9,14px)}.tour-stars.set-stars svg{width:13px;height:13px}}
`;

const patchTour=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'TourRun type',"export type TourRun={gigId:string};\ntype TourProgress={gigId:string,stars:number,bestScore:number,bestAccuracy:number,bestDifficulty:TourDifficulty};",tourTypesAndData);
 code=replaceBetween(code,'tour data',"const tours=[",'const tourStorageKey=',tourData+'const tourStorageKey=');
 code=replaceBetween(code,'record set result','export async function recordTourResult','export function TourScreen',recordTourResult+'export function TourScreen');
 code=replaceBetween(code,'Tour screen','export function TourScreen','const normalizeProfile',tourScreen+'const normalizeProfile');
 return code;
};

const patchMain=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'Tour imports',"import {TourScreen,SocialScreen,RankedScreen,recordTourResult,type TourRun} from './tour-social-ranked';","import {TourScreen,SocialScreen,RankedScreen,recordTourResult,advanceTourRun,getTourSongForRun,isTourSetComplete,type TourRun} from './tour-social-ranked';");
 code=replaceRequired(code,'Tour advance state'," const [tourRun,setTourRun]=useState<TourRun|null>(null);"," const [tourRun,setTourRun]=useState<TourRun|null>(null);\n const [tourAdvance,setTourAdvance]=useState<TourRun|null>(null);");
 code=replaceRequired(code,'Tour finish progression',"if(!multiplayerLaunch)void recordTourResult(playerAccount.userId,tourRun,r.score,r.accuracy,difficulty);setScreen('results')};","if(!multiplayerLaunch&&tourRun){const advanced=advanceTourRun(tourRun,r.score,r.accuracy);setTourAdvance(advanced);if(isTourSetComplete(advanced))void recordTourResult(playerAccount.userId,advanced)}setScreen('results')};");
 code=replaceRequired(code,'Free Play clears Tour set',"onPlay={()=>{setTourRun(null);setScreen('select')}}","onPlay={()=>{setTourRun(null);setTourAdvance(null);setScreen('select')}}");
 code=replaceRequired(code,'Tour launch clears advance',"setDifficulty(nextDifficulty);setTourRun(run);setMultiplayerLaunch(null);setScreen('game')","setDifficulty(nextDifficulty);setTourRun(run);setTourAdvance(null);setMultiplayerLaunch(null);setScreen('game')");
 code=replaceRequired(code,'Tour quit clears set',"quit={()=>{if(multiplayerLaunch){setMultiplayerLaunch(null);setScreen('home')}else if(tourRun){setTourRun(null);setScreen('tour')}else setScreen('select')}}","quit={()=>{if(multiplayerLaunch){setMultiplayerLaunch(null);setScreen('home')}else if(tourRun){setTourRun(null);setTourAdvance(null);setScreen('tour')}else setScreen('select')}}");
 code=replaceRequired(code,'Tour retry behavior',"retry={()=>multiplayerLaunch?multiplayerSession.requestRematch():setScreen('game')}","retry={()=>{if(multiplayerLaunch){multiplayerSession.requestRematch();return}if(tourRun)setTourAdvance(null);setScreen('game')}}");
 code=replaceRequired(code,'Tour result props',"battle={Boolean(multiplayerLaunch)} done=","battle={Boolean(multiplayerLaunch)} tour={Boolean(tourRun)} tourStep={tourRun?tourRun.songIndex+1:0} tourStars={tourAdvance?.setStars??tourRun?.setStars??0} tourComplete={Boolean(tourAdvance&&isTourSetComplete(tourAdvance))} tourChallengeFailed={Boolean(tourAdvance?.challengeFailed)} done=");
 code=replaceRequired(code,'Tour continue behavior',"done={()=>{if(multiplayerLaunch){setMultiplayerResume(null);setMultiplayerLaunch(null);setScreen('home')}else if(tourRun){setTourRun(null);setScreen('tour')}else setScreen('select')}}","done={()=>{if(multiplayerLaunch){setMultiplayerResume(null);setMultiplayerLaunch(null);setScreen('home')}else if(tourRun){if(tourAdvance?.challengeFailed){setTourAdvance(null);setTourRun(null);setScreen('tour')}else if(tourAdvance&&isTourSetComplete(tourAdvance)){setTourAdvance(null);setTourRun(null);setScreen('tour')}else if(tourAdvance){const next=getTourSongForRun(tourAdvance),selected=next?library.find(item=>item.id===next.songId):null;if(next&&selected){setSong(selected);setDifficulty(next.difficulty);setTourRun(tourAdvance);setTourAdvance(null);setScreen('game')}else{setTourAdvance(null);setTourRun(null);setScreen('tour')}}else{setTourRun(null);setScreen('tour')}}else setScreen('select')}}");
 code=replaceRequired(code,'Results Tour signature',"function Results({song,difficulty,result,profile,equipTheme,retry,changeSong,battle=false,done}:{song:Song,difficulty:Difficulty,result:GameResult,profile:Profile,equipTheme:(theme:NoteTheme)=>void,retry:()=>void,changeSong?:()=>void,battle?:boolean,done:()=>void}){","function Results({song,difficulty,result,profile,equipTheme,retry,changeSong,battle=false,tour=false,tourStep=0,tourStars=0,tourComplete=false,tourChallengeFailed=false,done}:{song:Song,difficulty:Difficulty,result:GameResult,profile:Profile,equipTheme:(theme:NoteTheme)=>void,retry:()=>void,changeSong?:()=>void,battle?:boolean,tour?:boolean,tourStep?:number,tourStars?:number,tourComplete?:boolean,tourChallengeFailed?:boolean,done:()=>void}){");
 const oldActions='<div className="result-actions">{battle?<><button className="primary" onClick={retry}><RotateCcw/> REMATCH</button><button className="secondary" onClick={()=>changeSong?.()}><Music2/> CHANGE SONG</button><button className="secondary battle-leave" onClick={done}><ArrowLeft/> LEAVE BATTLE</button></>:<><button className="primary" onClick={retry}><RotateCcw/> RETRY</button><button className="secondary" onClick={done}>TRACK SELECT</button></>}</div>';
 const newActions='{tour&&<div className={\'tour-result-banner \'+(tourChallengeFailed?\'challenge\':\'\')}>{tourChallengeFailed?\'HEADLINER CHALLENGE FAILED · 85% REQUIRED\':tourComplete?`SET COMPLETE · ${tourStars} / 9 STARS`:`SET SONG ${tourStep} / 3 · ${tourStars} / 9 STARS`}</div>}<div className="result-actions">{battle?<><button className="primary" onClick={retry}><RotateCcw/> REMATCH</button><button className="secondary" onClick={()=>changeSong?.()}><Music2/> CHANGE SONG</button><button className="secondary battle-leave" onClick={done}><ArrowLeft/> LEAVE BATTLE</button></>:tour?<><button className="primary" onClick={retry}><RotateCcw/> {tourChallengeFailed?\'RETRY HEADLINER\':\'RETRY SONG\'}</button><button className="secondary" onClick={done}>{tourChallengeFailed?\'EXIT TO TOUR\':tourComplete?\'FINISH SET\':\'CONTINUE SET\'}</button></>:<><button className="primary" onClick={retry}><RotateCcw/> RETRY</button><button className="secondary" onClick={done}>TRACK SELECT</button></>}</div>';
 code=replaceRequired(code,'Results Tour actions',oldActions,newActions);
 return code;
};

export function tourSetlistTransform():Plugin{
 return {name:'rhythtap-tour-setlist-transform',enforce:'pre',transform(source,id){
  const normalized=id.replaceAll('\\','/');
  if(normalized.endsWith('/src/tour-social-ranked.tsx'))return{code:patchTour(source),map:null};
  if(normalized.endsWith('/src/main.tsx'))return{code:patchMain(source),map:null};
  if(normalized.endsWith('/src/tour-social-ranked.css'))return{code:source+css,map:null};
  return null;
 }};
}
