import type {Plugin} from 'vite';

const replaceRequired=(source:string,label:string,before:string,after:string)=>{
 if(!source.includes(before))throw new Error(`[engagement-ui] Unable to patch ${label}; transformed app layout changed.`);
 return source.replace(before,after);
};

export function engagementUiTransform():Plugin{
 return {name:'rhythtap-engagement-ui-transform',enforce:'pre',transform(source,id){
  if(!id.replaceAll('\\','/').endsWith('/src/main.tsx'))return null;
  let code=source;
  code=replaceRequired(code,'imports',"import './ux.css';","import './ux.css';\nimport './engagement-ui.css';\nimport {trackEngagement} from './engagement-analytics';");
  code=replaceRequired(code,'app open analytics',
   " const [tourRun,setTourRun]=useState<TourRun|null>(null);",
   " const [tourRun,setTourRun]=useState<TourRun|null>(null);\n useEffect(()=>{void trackEngagement({name:'game_open',userId:playerAccount.userId,metadata:{screen:'home'}})},[]);");
  code=replaceRequired(code,'home solo action',
   "onPlay={()=>{setTourRun(null);setScreen('select')}}",
   "onPlay={()=>{void trackEngagement({name:'mode_selected',userId:playerAccount.userId,metadata:{mode:'solo'}});setTourRun(null);setScreen('select')}}");
  code=replaceRequired(code,'home tour action',
   "onTour={()=>setScreen('tour')}",
   "onTour={()=>{void trackEngagement({name:'home_primary_action',userId:playerAccount.userId,metadata:{action:'tour'}});setScreen('tour')}}");
  code=replaceRequired(code,'select render analytics',
   "{screen==='select'&&<Select songs={library} song={song} setSong={setSong} difficulty={difficulty} setDifficulty={setDifficulty}",
   "{screen==='select'&&<Select songs={library} song={song} setSong={value=>{setSong(value);void trackEngagement({name:'song_selected',userId:playerAccount.userId,songId:value.id,difficulty})}} difficulty={difficulty} setDifficulty={value=>{setDifficulty(value);void trackEngagement({name:'difficulty_selected',userId:playerAccount.userId,songId:song.id,difficulty:value})}}");
  code=replaceRequired(code,'song start analytics',
   "play={()=>setScreen('game')}",
   "play={()=>{void trackEngagement({name:'song_started',userId:playerAccount.userId,songId:song.id,difficulty,metadata:{source:'select'}});setScreen('game')}}");
  code=replaceRequired(code,'song complete analytics',
   "if(!multiplayerLaunch)void playerAccount.recordGame({songId:song.id,difficulty,score:r.score,accuracy:r.accuracy,maxCombo:r.maxCombo,perfectHits:r.counts.PERFECT});",
   "if(!multiplayerLaunch){void playerAccount.recordGame({songId:song.id,difficulty,score:r.score,accuracy:r.accuracy,maxCombo:r.maxCombo,perfectHits:r.counts.PERFECT});void trackEngagement({name:'song_completed',userId:playerAccount.userId,songId:song.id,difficulty,value:r.accuracy,metadata:{score:r.score,maxCombo:r.maxCombo,tour:Boolean(tourRun)}})};");
  code=replaceRequired(code,'results retry analytics',
   "retry={()=>setScreen('game')}",
   "retry={()=>{void trackEngagement({name:'song_retry',userId:playerAccount.userId,songId:song.id,difficulty,metadata:{score:result.score,accuracy:result.accuracy}});setScreen('game')}}");
  code=replaceRequired(code,'results continue analytics',
   "done={()=>{if(multiplayerLaunch){setMultiplayerResume(null);setMultiplayerLaunch(null);setScreen('home')}else if(tourRun){setTourRun(null);setScreen('tour')}else setScreen('select')}}",
   "done={()=>{void trackEngagement({name:'results_continue',userId:playerAccount.userId,songId:song.id,difficulty,metadata:{destination:multiplayerLaunch?'home':tourRun?'tour':'select'}});if(multiplayerLaunch){setMultiplayerResume(null);setMultiplayerLaunch(null);setScreen('home')}else if(tourRun){setTourRun(null);setScreen('tour')}else setScreen('select')}}");
  code=replaceRequired(code,'home class',
   "return <section className=\"home screen metal-home\">",
   "return <section className=\"home screen metal-home engagement-home\">");
  code=replaceRequired(code,'tour hero copy',
   "<small>THE MAIN RHYTHMTAP EXPERIENCE</small><strong>RHYTHMTAP TOUR</strong><em>Start small. Earn stars. Unlock bigger gigs. Become the headliner.</em><b>CONTINUE TOUR <ChevronRight/></b>",
   "<small>YOUR NEXT SET</small><strong>CONTINUE RHYTHMTAP TOUR</strong><em>Keep your career moving · chase stars · unlock the next venue.</em><b>PLAY NEXT <ChevronRight/></b>");
  const utilityAnchor='  <div className="metal-utility-grid">';
  const utilityReplacement='  <div className="engagement-strip"><div><small>NEXT LEVEL</small><strong>{xpNeeded-xpCurrent} XP TO GO</strong></div><div><small>PERSONAL TARGET</small><strong>{stats.bestCombo>0?stats.bestCombo+" BEST COMBO":"SET YOUR FIRST COMBO"}</strong></div></div>\n'+utilityAnchor;
  code=replaceRequired(code,'home engagement strip',utilityAnchor,utilityReplacement);
  code=replaceRequired(code,'select summary',
   " {previewError&&<div className=\"preview-error\">{previewError}</div>}",
   " {previewError&&<div className=\"preview-error\">{previewError}</div>}\n <div className=\"engagement-select-summary engagement-select\"><small>READY TO PLAY</small><strong>{song.title}</strong><span><b>{difficulty}</b><b>{song.charts[difficulty].length} NOTES</b><b>{highScoreFor(song.id,difficulty)>0?'BEST '+highScoreFor(song.id,difficulty).toLocaleString():'NO SCORE YET'}</b></span></div>");
  code=replaceRequired(code,'results hero banner',
   "<div className=\"result-hero\">",
   "<div className=\"engagement-results-banner engagement-results\"><strong className={isNewBest?'engagement-pb':result.accuracy>=93?'engagement-near':''}>{isNewBest?'NEW PERSONAL BEST':result.accuracy>=93?'SO CLOSE TO AN S':'SET COMPLETE'}</strong><span><small>{difficulty} PERFORMANCE</small><strong>{isNewBest&&previousBest>0?`+${(result.score-previousBest).toLocaleString()} OVER BEST`:result.accuracy>=93?`${(95-result.accuracy).toFixed(1)}% FROM S RANK`:`${result.accuracy.toFixed(1)}% ACCURACY`}</strong></span></div><div className=\"result-hero\">");
  code=replaceRequired(code,'result actions',
   "<div className=\"result-actions\"><button className=\"primary\" onClick={retry}><RotateCcw/> RETRY</button><button className=\"secondary\" onClick={done}>TRACK SELECT</button></div>",
   "<div className=\"result-actions engagement-result-actions\"><button className=\"primary\" onClick={done}><ChevronRight/> CONTINUE</button><button className=\"secondary\" onClick={retry}><RotateCcw/> RETRY</button></div><div className=\"engagement-next\"><small>NEXT MOVE</small><strong>{isNewBest?'Bank the record and keep the run going.':result.accuracy>=93?'One clean retry could push this into S rank.':'Continue to pick the next track, or retry to improve this score.'}</strong></div>");
  return {code,map:null};
 }};
}
