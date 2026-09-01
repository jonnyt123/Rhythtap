import type {Plugin} from 'vite';

const replaceRequired=(source:string,label:string,before:string,after:string)=>{
 if(!source.includes(before))throw new Error(`[tour-social-ranked] Unable to patch ${label}; transformed app layout changed.`);
 return source.replace(before,after);
};

export function tourSocialRankedTransform():Plugin{
 return {name:'rhythtap-tour-social-ranked-transform',enforce:'pre',transform(source,id){
  if(!id.replaceAll('\\','/').endsWith('/src/main.tsx'))return null;
  let code=source;
  code=replaceRequired(code,'feature imports',
   "import {AccountScreen,PublicProfileScreen,usePlayerAccount,type PlayerAccountController} from './player-account';",
   "import {AccountScreen,PublicProfileScreen,usePlayerAccount,type PlayerAccountController} from './player-account';\nimport {TourScreen,SocialScreen,RankedScreen,recordTourResult,type TourRun} from './tour-social-ranked';");
  code=replaceRequired(code,'screens',
   "type Screen='home'|'select'|'library'|'leaderboard'|'multiplayer'|'account'|'publicProfile'|'game'|'results'|'settings'|'achievements';",
   "type Screen='home'|'select'|'library'|'leaderboard'|'multiplayer'|'account'|'publicProfile'|'tour'|'social'|'ranked'|'game'|'results'|'settings'|'achievements';");
  code=replaceRequired(code,'tour state',
   " const [multiplayerResume,setMultiplayerResume]=useState<{roomCode:string,isHost:boolean}|null>(null);",
   " const [multiplayerResume,setMultiplayerResume]=useState<{roomCode:string,isHost:boolean}|null>(null);\n const [tourRun,setTourRun]=useState<TourRun|null>(null);");
  code=replaceRequired(code,'record tour result',
   "setResult({...r,xpEarned,dailyBonus,levelUp:level>previousLevel,previousLevel});if(!multiplayerLaunch)void playerAccount.recordGame({songId:song.id,difficulty,score:r.score,accuracy:r.accuracy,maxCombo:r.maxCombo,perfectHits:r.counts.PERFECT});setScreen('results')};",
   "setResult({...r,xpEarned,dailyBonus,levelUp:level>previousLevel,previousLevel});if(!multiplayerLaunch){void playerAccount.recordGame({songId:song.id,difficulty,score:r.score,accuracy:r.accuracy,maxCombo:r.maxCombo,perfectHits:r.counts.PERFECT});void recordTourResult(playerAccount.userId,tourRun,r.score,r.accuracy,difficulty)}setScreen('results')};");
  code=replaceRequired(code,'home navigation',
   "{screen==='home'&&<Home profile={profile} stats={stats} account={playerAccount} onPlay={()=>setScreen('select')} onMultiplayer={()=>setScreen('multiplayer')} onAccount={()=>setScreen('account')} onLibrary={()=>setScreen('library')} onAchievements={()=>setScreen('achievements')} onSettings={()=>setScreen('settings')}/>} ".trim(),
   "{screen==='home'&&<Home profile={profile} stats={stats} account={playerAccount} onPlay={()=>{setTourRun(null);setScreen('select')}} onTour={()=>setScreen('tour')} onSocial={()=>setScreen('social')} onRanked={()=>setScreen('ranked')} onMultiplayer={()=>setScreen('multiplayer')} onAccount={()=>setScreen('account')} onLibrary={()=>setScreen('library')} onAchievements={()=>setScreen('achievements')} onSettings={()=>setScreen('settings')}/>} ".trim());
  code=replaceRequired(code,'feature screens',
   "  {screen==='account'&&<AccountScreen account={playerAccount} back={()=>setScreen('home')}/>}",
   "  {screen==='tour'&&<TourScreen songs={library} profileLevel={profile.level} userId={playerAccount.userId} back={()=>setScreen('home')} onPlay={(songId,nextDifficulty,run)=>{const selected=library.find(item=>item.id===songId);if(!selected)return;setSong(selected);setDifficulty(nextDifficulty);setTourRun(run);setMultiplayerLaunch(null);setScreen('game')}}/>}\n  {screen==='social'&&<SocialScreen userId={playerAccount.userId} back={()=>setScreen('home')} onBattle={(roomCode,isHost)=>{setMultiplayerResume({roomCode,isHost});setScreen('multiplayer')}}/>}\n  {screen==='ranked'&&<RankedScreen songs={library} userId={playerAccount.userId} back={()=>setScreen('home')}/>}\n  {screen==='account'&&<AccountScreen account={playerAccount} back={()=>setScreen('home')}/>}" );
  code=replaceRequired(code,'results tour return',
   "done={()=>{if(multiplayerLaunch){setMultiplayerResume(null);setMultiplayerLaunch(null);setScreen('home')}else setScreen('select')}}",
   "done={()=>{if(multiplayerLaunch){setMultiplayerResume(null);setMultiplayerLaunch(null);setScreen('home')}else if(tourRun){setTourRun(null);setScreen('tour')}else setScreen('select')}}");
  code=replaceRequired(code,'home signature',
   "function Home({profile:localProfile,stats:localStats,account,onPlay,onMultiplayer,onAccount,onLibrary,onAchievements,onSettings}:{profile:Profile,stats:Stats,account:PlayerAccountController,onPlay:()=>void,onMultiplayer:()=>void,onAccount:()=>void,onLibrary:()=>void,onAchievements:()=>void,onSettings:()=>void})",
   "function Home({profile:localProfile,stats:localStats,account,onPlay,onTour,onSocial,onRanked,onMultiplayer,onAccount,onLibrary,onAchievements,onSettings}:{profile:Profile,stats:Stats,account:PlayerAccountController,onPlay:()=>void,onTour:()=>void,onSocial:()=>void,onRanked:()=>void,onMultiplayer:()=>void,onAccount:()=>void,onLibrary:()=>void,onAchievements:()=>void,onSettings:()=>void})");
  code=replaceRequired(code,'home feature buttons',
   '<div className="quick-grid"><button onClick={onAccount}>',
   '<div className="quick-grid"><button onClick={onTour}><span><Trophy/></span><div><small>RHYTHMTAP TOUR</small><strong>Career gigs · earn stars · unlock headliners</strong></div><ChevronRight/></button><button onClick={onSocial}><span><User/></span><div><small>FRIENDS + INVITES</small><strong>See friends online · challenge them directly</strong></div><ChevronRight/></button><button onClick={onRanked}><span><Award/></span><div><small>RANKED</small><strong>Battle rating · global song leaderboards</strong></div><ChevronRight/></button><button onClick={onAccount}>');
  return {code,map:null};
 }};
}
