import type {Plugin} from 'vite';

const replaceRequired=(source:string,label:string,before:string,after:string)=>{
 if(!source.includes(before))throw new Error(`[tour-setlists] Unable to patch ${label}; transformed layout changed.`);
 return source.replace(before,after);
};

const replaceBetweenRequired=(source:string,label:string,start:string,end:string,replacement:string)=>{
 const from=source.indexOf(start),to=source.indexOf(end,from+start.length);
 if(from<0||to<0)throw new Error(`[tour-setlists] Unable to patch ${label}; transformed layout changed.`);
 return source.slice(0,from)+replacement+source.slice(to);
};

const tourModel=`const tours=[
 {id:'basement',venue:'BASEMENT SHOW',city:'OPENING NIGHT',songs:[
  {songId:'sickness',difficulty:'EASY' as TourDifficulty,label:'OPENER',passAccuracy:70},
  {songId:'never-left',difficulty:'EASY' as TourDifficulty,label:'SECOND SET',passAccuracy:70},
  {songId:'kryptonite',difficulty:'EASY' as TourDifficulty,label:'HEADLINER CHALLENGE',passAccuracy:80},
 ]},
 {id:'skatepark',venue:'SKATEPARK SET',city:'FIRST FOLLOWING',songs:[
  {songId:'never-left',difficulty:'EASY' as TourDifficulty,label:'OPENER',passAccuracy:70},
  {songId:'fly-eagle',difficulty:'NORMAL' as TourDifficulty,label:'SECOND SET',passAccuracy:70},
  {songId:'kryptonite',difficulty:'NORMAL' as TourDifficulty,label:'HEADLINER CHALLENGE',passAccuracy:80},
 ]},
 {id:'club',venue:'CLUB STAGE',city:'PACKED HOUSE',songs:[
  {songId:'kryptonite',difficulty:'NORMAL' as TourDifficulty,label:'OPENER',passAccuracy:70},
  {songId:'my-immortal',difficulty:'NORMAL' as TourDifficulty,label:'SECOND SET',passAccuracy:70},
  {songId:'crazy-train',difficulty:'NORMAL' as TourDifficulty,label:'HEADLINER CHALLENGE',passAccuracy:80},
 ]},
 {id:'theatre',venue:'THEATRE NIGHT',city:'THE BIGGER ROOM',songs:[
  {songId:'my-immortal',difficulty:'NORMAL' as TourDifficulty,label:'OPENER',passAccuracy:70},
  {songId:'fly-eagle',difficulty:'NORMAL' as TourDifficulty,label:'SECOND SET',passAccuracy:70},
  {songId:'crazy-train',difficulty:'HARD' as TourDifficulty,label:'HEADLINER CHALLENGE',passAccuracy:80},
 ]},
 {id:'arena',venue:'ARENA SUPPORT',city:'BIG STAGE',songs:[
  {songId:'crazy-train',difficulty:'HARD' as TourDifficulty,label:'OPENER',passAccuracy:70},
  {songId:'sickness',difficulty:'HARD' as TourDifficulty,label:'SECOND SET',passAccuracy:70},
  {songId:'kill-you',difficulty:'HARD' as TourDifficulty,label:'HEADLINER CHALLENGE',passAccuracy:80},
 ]},
 {id:'headliner',venue:'FINAL HEADLINER',city:'TOUR FINALE',songs:[
  {songId:'kill-you',difficulty:'HARD' as TourDifficulty,label:'OPENER',passAccuracy:75},
  {songId:'my-immortal',difficulty:'HARD' as TourDifficulty,label:'SECOND SET',passAccuracy:75},
  {songId:'through-fire-flames',difficulty:'HARD' as TourDifficulty,label:'FINAL HEADLINER CHALLENGE',passAccuracy:85},
 ]},
];
type TourSetStep=(typeof tours)[number]['songs'][number];
const progressId=(run:TourRun)=>run.gigId+':'+run.songIndex;
const stepProgress=(progress:TourProgress[],gigId:string,index:number)=>progress.find(row=>row.gigId===gigId+':'+index);
const stepPassed=(progress:TourProgress[],gigId:string,index:number,step:TourSetStep)=>Number(stepProgress(progress,gigId,index)?.bestAccuracy||0)>=step.passAccuracy;
const gigComplete=(progress:TourProgress[],gig:(typeof tours)[number])=>gig.songs.every((step,index)=>stepPassed(progress,gig.id,index,step));
export const getTourStep=(run:TourRun)=>{const gig=tours.find(item=>item.id===run.gigId),step=gig?.songs[run.songIndex];return step?{songId:step.songId,difficulty:step.difficulty,passAccuracy:step.passAccuracy,label:step.label}:null};
export const nextTourRun=(run:TourRun):TourRun|null=>{const gig=tours.find(item=>item.id===run.gigId);return gig&&run.songIndex+1<gig.songs.length?{gigId:run.gigId,songIndex:run.songIndex+1}:null};
export const tourRunIsFinal=(run:TourRun)=>nextTourRun(run)===null;
`;

const recordTour=`export async function recordTourResult(userId:string|null,run:TourRun|null,score:number,accuracy:number,difficulty:TourDifficulty){
 if(!run)return;
 const id=progressId(run),stars=starsFor(accuracy),local=readLocalTour(userId),existing=local.find(x=>x.gigId===id),next:TourProgress={gigId:id,stars:Math.max(stars,existing?.stars||0),bestScore:Math.max(score,existing?.bestScore||0),bestAccuracy:Math.max(accuracy,existing?.bestAccuracy||0),bestDifficulty:diffRank(difficulty)>=diffRank(existing?.bestDifficulty||'EASY')?difficulty:(existing?.bestDifficulty||'EASY')};
 saveLocalTour(userId,[...local.filter(x=>x.gigId!==id),next]);
 if(!userId)return;
 try{const client=await getAppClient();const{data}=await client.from('player_tour_progress').select('*').eq('user_id',userId).eq('gig_id',id).maybeSingle();const cloud=data||{};await client.from('player_tour_progress').upsert({user_id:userId,gig_id:id,stars:Math.max(stars,Number(cloud.stars)||0),best_score:Math.max(score,Number(cloud.best_score)||0),best_accuracy:Math.max(accuracy,Number(cloud.best_accuracy)||0),best_difficulty:diffRank(difficulty)>=diffRank((cloud.best_difficulty||'EASY') as TourDifficulty)?difficulty:cloud.best_difficulty||'EASY',completed_at:accuracy>=70?(cloud.completed_at||new Date().toISOString()):cloud.completed_at,updated_at:new Date().toISOString()})}catch(e){console.warn('[tour] cloud progress sync failed',e)}
}

`;

const tourScreen=`export function TourScreen({songs,profileLevel:_profileLevel,userId,back,onPlay}:{songs:TourSong[],profileLevel:number,userId:string|null,back:()=>void,onPlay:(songId:string,difficulty:TourDifficulty,run:TourRun)=>void}){
 const[progress,setProgress]=useState<TourProgress[]>(()=>readLocalTour(userId)),[loading,setLoading]=useState(Boolean(userId));
 useEffect(()=>{let mounted=true;setProgress(readLocalTour(userId));setLoading(Boolean(userId));(async()=>{if(!userId){setLoading(false);return}try{const client=await getAppClient(),{data}=await client.from('player_tour_progress').select('*').eq('user_id',userId);if(!mounted)return;const cloud=(data||[]).map((r:any)=>({gigId:String(r.gig_id),stars:Number(r.stars)||0,bestScore:Number(r.best_score)||0,bestAccuracy:Number(r.best_accuracy)||0,bestDifficulty:String(r.best_difficulty||'EASY') as TourDifficulty}));setProgress(cloud);saveLocalTour(userId,cloud)}finally{if(mounted)setLoading(false)}})();return()=>{mounted=false}},[userId]);
 const total=progress.filter(row=>row.gigId.includes(':')).reduce((n,p)=>n+p.stars,0),maxStars=tours.reduce((n,gig)=>n+gig.songs.length*3,0),songMap=useMemo(()=>new Map(songs.map(s=>[s.id,s])),[songs]);
 const completed=tours.filter(gig=>gigComplete(progress,gig)).length;
 return <section className="tsr-screen screen"><Header eyebrow="CAREER" title="RHYTHMTAP TOUR" back={back}/><div className="tsr-wrap"><div className="tour-hero tour-set-hero"><div><small>TOUR STARS</small><strong>{total} / {maxStars}</strong><p>Every venue is a 3-song set. Pass each song, clear the headliner challenge, then the next venue unlocks.</p><div className="tour-set-meter"><i style={{width:Math.min(100,completed/tours.length*100)+'%'}}/></div><em>{completed} / {tours.length} GIGS CLEARED</em></div><Trophy/></div><div className="tour-line tour-set-line">{tours.map((gig,index)=>{const unlocked=index===0||gigComplete(progress,tours[index-1]),complete=gigComplete(progress,gig),gigStars=gig.songs.reduce((sum,_,songIndex)=>sum+Number(stepProgress(progress,gig.id,songIndex)?.stars||0),0),firstIncomplete=gig.songs.findIndex((step,songIndex)=>!stepPassed(progress,gig.id,songIndex,step)),startIndex=firstIncomplete<0?0:firstIncomplete,missing=gig.songs.some(step=>!songMap.has(step.songId));return <article key={gig.id} className={'tour-stop tour-set-stop '+(unlocked?'':'locked')+(complete?' complete':'')}><div className="tour-set-heading"><div className="tour-index">{complete?<Check/>:unlocked?index+1:<Lock/>}</div><div className="tour-copy"><small>{gig.city}</small><h3>{gig.venue}</h3><span>{complete?'SET CLEARED':'3-SONG GIG'}</span></div><div className="tour-set-score"><strong>{gigStars}/9</strong><small>STARS</small></div></div><div className="tour-setlist">{gig.songs.map((step,songIndex)=>{const track=songMap.get(step.songId),p=stepProgress(progress,gig.id,songIndex),passed=stepPassed(progress,gig.id,songIndex,step),headliner=songIndex===gig.songs.length-1;return <div key={step.songId+'-'+songIndex} className={'tour-set-song '+(passed?'passed ':'')+(headliner?'headliner':'')}><span className="tour-set-number">{passed?<Check/>:headliner?<Crown/>:songIndex+1}</span><div><small>{step.label} · {step.difficulty}</small><strong>{track?.title||step.songId}</strong><em>{track?.artist||''}</em></div><div className="tour-song-stars">{[1,2,3].map(n=><Star key={n} fill={(p?.stars||0)>=n?'currentColor':'none'}/>)}</div><span className="tour-pass">{passed?'PASSED':`${step.passAccuracy}%+`}</span></div>})}</div><div className="tour-set-footer"><small>{complete?'Replay the full set for more stars.':unlocked?'Finish all three songs to unlock the next venue.':'Clear the previous gig to unlock.'}</small><button className="primary compact" disabled={!unlocked||missing||loading} onClick={()=>{const step=gig.songs[startIndex];if(step)onPlay(step.songId,step.difficulty,{gigId:gig.id,songIndex:startIndex})}}><Play/> {complete?'REPLAY SET':firstIncomplete>0?'CONTINUE SET':'START SET'}</button></div></article>})}</div></div></section>;
}

`;

const css=`
/* Tour setlists: three-song gigs with headliner gates */
.tour-set-hero{align-items:flex-start}.tour-set-hero em{display:block;margin-top:8px;font-style:normal;font-size:11px;letter-spacing:.12em;color:var(--muted)}.tour-set-meter{height:5px;margin-top:14px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.09)}.tour-set-meter i{display:block;height:100%;background:linear-gradient(90deg,#29d7ff,#ff3dad)}
.tour-set-line{gap:16px}.tour-set-stop{display:block;padding:0;overflow:hidden}.tour-set-heading{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:14px;padding:18px}.tour-set-score{text-align:right}.tour-set-score strong{display:block;font-size:22px}.tour-set-score small{font-size:9px;letter-spacing:.14em;color:var(--muted)}
.tour-setlist{border-top:1px solid rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.08)}.tour-set-song{display:grid;grid-template-columns:34px minmax(0,1fr) auto auto;align-items:center;gap:10px;padding:12px 18px;border-top:1px solid rgba(255,255,255,.055)}.tour-set-song:first-child{border-top:0}.tour-set-song.headliner{background:linear-gradient(90deg,rgba(255,61,173,.09),rgba(255,190,61,.05))}.tour-set-song.passed{opacity:.92}.tour-set-number{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.08);font-weight:900}.tour-set-number svg{width:15px}.tour-set-song>div:nth-child(2){min-width:0}.tour-set-song>div:nth-child(2) small,.tour-set-song>div:nth-child(2) em{display:block;font-size:9px;letter-spacing:.08em;color:var(--muted);font-style:normal}.tour-set-song>div:nth-child(2) strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tour-song-stars{display:flex;gap:2px}.tour-song-stars svg{width:13px}.tour-pass{min-width:54px;text-align:right;font-size:9px;font-weight:900;letter-spacing:.08em}.tour-set-song.passed .tour-pass{color:#8dffae}.tour-set-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px}.tour-set-footer>small{max-width:420px;color:var(--muted)}
@media(max-width:620px){.tour-set-song{grid-template-columns:30px minmax(0,1fr) auto;padding:11px 12px}.tour-song-stars{grid-column:2;justify-content:flex-start}.tour-pass{grid-column:3;grid-row:1 / span 2}.tour-set-footer{align-items:stretch;flex-direction:column}.tour-set-footer button{width:100%;min-height:50px}.tour-set-heading{padding:15px 12px}.tour-set-hero p{max-width:30ch}}
`;

const patchTour=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'tour run type',"export type TourRun={gigId:string};","export type TourRun={gigId:string,songIndex:number};");
 code=replaceBetweenRequired(code,'tour model','const tours=[','const diffRank=',tourModel);
 code=replaceBetweenRequired(code,'record result','export async function recordTourResult','export function TourScreen',recordTour);
 code=replaceBetweenRequired(code,'tour screen','export function TourScreen','const normalizeProfile=',tourScreen);
 return code;
};

const patchMain=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'tour helpers import',
  "import {TourScreen,SocialScreen,RankedScreen,recordTourResult,type TourRun} from './tour-social-ranked';",
  "import {TourScreen,SocialScreen,RankedScreen,recordTourResult,getTourStep,nextTourRun,tourRunIsFinal,type TourRun} from './tour-social-ranked';");
 code=replaceRequired(code,'tour result label prop',
  "battle={Boolean(multiplayerLaunch)} done={()=>{if(multiplayerLaunch)",
  "battle={Boolean(multiplayerLaunch)} doneLabel={tourRun?(result.accuracy<(getTourStep(tourRun)?.passAccuracy||70)?(tourRunIsFinal(tourRun)?'RETRY CHALLENGE':'RETRY SONG'):tourRunIsFinal(tourRun)?'COMPLETE GIG':'NEXT SONG'):undefined} done={()=>{if(multiplayerLaunch)");
 code=replaceRequired(code,'tour results continuation',
  "else if(tourRun){setTourRun(null);setScreen('tour')}else setScreen('select')}}",
  "else if(tourRun){const step=getTourStep(tourRun);if(result.accuracy<(step?.passAccuracy||70)){setScreen('game');return}const next=nextTourRun(tourRun);if(!next){setTourRun(null);setScreen('tour');return}const nextStep=getTourStep(next),selected=nextStep?library.find(item=>item.id===nextStep.songId):undefined;if(!nextStep||!selected){setTourRun(null);setScreen('tour');return}setSong(selected);setDifficulty(nextStep.difficulty);setTourRun(next);setScreen('game')}else setScreen('select')}}");
 code=replaceRequired(code,'results done label signature',
  "function Results({song,difficulty,result,profile,equipTheme,retry,changeSong,battle=false,done}:{song:Song,difficulty:Difficulty,result:GameResult,profile:Profile,equipTheme:(theme:NoteTheme)=>void,retry:()=>void,changeSong?:()=>void,battle?:boolean,done:()=>void}){",
  "function Results({song,difficulty,result,profile,equipTheme,retry,changeSong,battle=false,doneLabel,done}:{song:Song,difficulty:Difficulty,result:GameResult,profile:Profile,equipTheme:(theme:NoteTheme)=>void,retry:()=>void,changeSong?:()=>void,battle?:boolean,doneLabel?:string,done:()=>void}){");
 code=replaceRequired(code,'results done label',
  '<button className="secondary" onClick={done}>TRACK SELECT</button>',
  '<button className="secondary" onClick={done}>{doneLabel||\'TRACK SELECT\'}</button>');
 code=code.replace('Start small. Earn stars. Unlock bigger gigs. Become the headliner.','Play 3-song sets. Earn stars. Clear the headliner challenge. Unlock the next venue.');
 return code;
};

export function tourSetlistsTransform():Plugin{
 return {name:'rhythtap-tour-setlists-transform',enforce:'pre',transform(source,id){
  const normalized=id.replaceAll('\\','/');
  if(normalized.endsWith('/src/tour-social-ranked.tsx'))return{code:patchTour(source),map:null};
  if(normalized.endsWith('/src/tour-social-ranked.css'))return{code:source+css,map:null};
  if(normalized.endsWith('/src/main.tsx'))return{code:patchMain(source),map:null};
  return null;
 }};
}
