import type {Plugin} from 'vite';

const replaceRequired=(source:string,label:string,before:string,after:string)=>{
 if(!source.includes(before))throw new Error(`[tour-setlist-career] Unable to patch ${label}; transformed layout changed.`);
 return source.replace(before,after);
};

export function tourSetlistCareerTransform():Plugin{
 return {name:'rhythtap-tour-setlist-career-transform',enforce:'pre',transform(source,id){
  if(!id.replaceAll('\\','/').endsWith('/src/main.tsx'))return null;
  let code=source;
  code=replaceRequired(code,'tour import',
   "import {TourScreen,SocialScreen,RankedScreen,recordTourResult,type TourRun} from './tour-social-ranked';",
   "import {SocialScreen,RankedScreen} from './tour-social-ranked';\nimport {TourSetlistScreen,recordTourSetlistResult,type TourSetlistRun} from './tour-setlist-career';");
  code=replaceRequired(code,'tour run type',
   "const [tourRun,setTourRun]=useState<TourRun|null>(null);",
   "const [tourRun,setTourRun]=useState<TourSetlistRun|null>(null);");
  code=replaceRequired(code,'tour result recorder',
   "recordTourResult(playerAccount.userId,tourRun,r.score,r.accuracy,difficulty)",
   "recordTourSetlistResult(playerAccount.userId,tourRun,r.score,r.accuracy,difficulty)");
  code=replaceRequired(code,'tour screen',
   "{screen==='tour'&&<TourScreen songs={library} profileLevel={profile.level} userId={playerAccount.userId} back={()=>setScreen('home')} onPlay={(songId,nextDifficulty,run)=>{const selected=library.find(item=>item.id===songId);if(!selected)return;setSong(selected);setDifficulty(nextDifficulty);setTourRun(run);setMultiplayerLaunch(null);setScreen('game')}}/>}",
   "{screen==='tour'&&<TourSetlistScreen songs={library} profileLevel={profile.level} userId={playerAccount.userId} back={()=>setScreen('home')} onPlay={(songId,nextDifficulty,run)=>{const selected=library.find(item=>item.id===songId);if(!selected)return;setSong(selected);setDifficulty(nextDifficulty);setTourRun(run);setMultiplayerLaunch(null);setScreen('game')}}/>}");
  code=replaceRequired(code,'tour result props',
   "battle={Boolean(multiplayerLaunch)} done=",
   "battle={Boolean(multiplayerLaunch)} tour={Boolean(tourRun)} tourNext={Boolean(tourRun&&tourRun.songIndex+1<tourRun.setlist.length)} done=");
  code=replaceRequired(code,'tour result advance',
   "done={()=>{if(multiplayerLaunch){setMultiplayerResume(null);setMultiplayerLaunch(null);setScreen('home')}else if(tourRun){setTourRun(null);setScreen('tour')}else setScreen('select')}}",
   "done={()=>{if(multiplayerLaunch){setMultiplayerResume(null);setMultiplayerLaunch(null);setScreen('home')}else if(tourRun){const nextIndex=tourRun.songIndex+1,nextStage=tourRun.setlist[nextIndex];if(nextStage){const nextSong=library.find(item=>item.id===nextStage.songId);if(nextSong){setSong(nextSong);setDifficulty(nextStage.difficulty);setTourRun({...tourRun,gigId:nextStage.gigId,songIndex:nextIndex});setScreen('game');return}}setTourRun(null);setScreen('tour')}else setScreen('select')}}");
  code=replaceRequired(code,'results signature',
   "function Results({song,difficulty,result,profile,equipTheme,retry,changeSong,battle=false,done}:{song:Song,difficulty:Difficulty,result:GameResult,profile:Profile,equipTheme:(theme:NoteTheme)=>void,retry:()=>void,changeSong?:()=>void,battle?:boolean,done:()=>void}){",
   "function Results({song,difficulty,result,profile,equipTheme,retry,changeSong,battle=false,tour=false,tourNext=false,done}:{song:Song,difficulty:Difficulty,result:GameResult,profile:Profile,equipTheme:(theme:NoteTheme)=>void,retry:()=>void,changeSong?:()=>void,battle?:boolean,tour?:boolean,tourNext?:boolean,done:()=>void}){");
  code=replaceRequired(code,'results tour action',
   '<div className="result-actions">{battle?<><button className="primary" onClick={retry}><RotateCcw/> REMATCH</button><button className="secondary" onClick={()=>changeSong?.()}><Music2/> CHANGE SONG</button><button className="secondary battle-leave" onClick={done}><ArrowLeft/> LEAVE BATTLE</button></>:<><button className="primary" onClick={retry}><RotateCcw/> RETRY</button><button className="secondary" onClick={done}>TRACK SELECT</button></>}</div>',
   '<div className="result-actions">{battle?<><button className="primary" onClick={retry}><RotateCcw/> REMATCH</button><button className="secondary" onClick={()=>changeSong?.()}><Music2/> CHANGE SONG</button><button className="secondary battle-leave" onClick={done}><ArrowLeft/> LEAVE BATTLE</button></>:<><button className="primary" onClick={retry}><RotateCcw/> RETRY</button><button className="secondary" onClick={done}>{tour?(tourNext?\'NEXT SONG\':\'FINISH GIG\'):\'TRACK SELECT\'}</button></>}</div>');
  return {code,map:null};
 }};
}
