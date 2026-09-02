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
   "import {AccountScreen,PublicProfileScreen,usePlayerAccount,type PlayerAccountController} from './player-account';\nimport {TourScreen,SocialScreen,RankedScreen,recordTourResult,type TourRun} from './tour-social-ranked';\nimport {RhythmTapTutorial,tutorialComplete} from './rhythmtap-tutorial';");
  code=replaceRequired(code,'screens',
   "type Screen='home'|'select'|'library'|'leaderboard'|'multiplayer'|'account'|'publicProfile'|'game'|'results'|'settings'|'achievements';",
   "type Screen='home'|'select'|'library'|'leaderboard'|'multiplayer'|'account'|'publicProfile'|'tour'|'social'|'ranked'|'tutorial'|'game'|'results'|'settings'|'achievements';");
  code=replaceRequired(code,'first launch tutorial',
   "const [screen,setScreen]=useState<Screen>(()=>location.hash.startsWith('#player/')?'publicProfile':'home'),",
   "const [screen,setScreen]=useState<Screen>(()=>location.hash.startsWith('#player/')?'publicProfile':tutorialComplete()?'home':'tutorial'),");
  code=replaceRequired(code,'tour state',
   " const [multiplayerResume,setMultiplayerResume]=useState<{roomCode:string,isHost:boolean}|null>(null);",
   " const [multiplayerResume,setMultiplayerResume]=useState<{roomCode:string,isHost:boolean}|null>(null);\n const [tourRun,setTourRun]=useState<TourRun|null>(null);");
  code=replaceRequired(code,'record tour result',
   "setScreen('results')};",
   "if(!multiplayerLaunch)void recordTourResult(playerAccount.userId,tourRun,r.score,r.accuracy,difficulty);setScreen('results')};");
  code=replaceRequired(code,'home feature callbacks',
   "onPlay={()=>setScreen('select')} onMultiplayer={()=>setScreen(playerAccount.profile?'multiplayer':'account')}",
   "onPlay={()=>{setTourRun(null);setScreen('select')}} onTour={()=>setScreen('tour')} onTutorial={()=>setScreen('tutorial')} onSocial={()=>setScreen('social')} onRanked={()=>setScreen('ranked')} onMultiplayer={()=>setScreen(playerAccount.profile?'multiplayer':'account')}");
  code=replaceRequired(code,'feature screens',
   "  {screen==='account'&&<AccountScreen account={playerAccount} back={()=>setScreen('home')}/>}",
   "  {screen==='tutorial'&&<RhythmTapTutorial onDone={()=>setScreen('home')}/>}\n  {screen==='tour'&&<TourScreen songs={library} profileLevel={profile.level} userId={playerAccount.userId} back={()=>setScreen('home')} onPlay={(songId,nextDifficulty,run)=>{const selected=library.find(item=>item.id===songId);if(!selected)return;setSong(selected);setDifficulty(nextDifficulty);setTourRun(run);setMultiplayerLaunch(null);setScreen('game')}}/>}\n  {screen==='social'&&<SocialScreen userId={playerAccount.userId} back={()=>setScreen('home')} onBattle={(roomCode,isHost)=>{setMultiplayerResume({roomCode,isHost});setScreen('multiplayer')}}/>}\n  {screen==='ranked'&&<RankedScreen songs={library} userId={playerAccount.userId} back={()=>setScreen('home')}/>}\n  {screen==='account'&&<AccountScreen account={playerAccount} back={()=>setScreen('home')}/>}" );
  code=replaceRequired(code,'results tour return',
   "done={()=>{if(multiplayerLaunch){setMultiplayerResume(null);setMultiplayerLaunch(null);setScreen('home')}else setScreen('select')}}",
   "done={()=>{if(multiplayerLaunch){setMultiplayerResume(null);setMultiplayerLaunch(null);setScreen('home')}else if(tourRun){setTourRun(null);setScreen('tour')}else setScreen('select')}}");
  code=replaceRequired(code,'home signature',
   "function Home({profile:localProfile,stats:localStats,account,onPlay,onMultiplayer,onAccount,onLibrary,onAchievements,onSettings}:{profile:Profile,stats:Stats,account:PlayerAccountController,onPlay:()=>void,onMultiplayer:()=>void,onAccount:()=>void,onLibrary:()=>void,onAchievements:()=>void,onSettings:()=>void})",
   "function Home({profile:localProfile,stats:localStats,account,onPlay,onTour,onTutorial,onSocial,onRanked,onMultiplayer,onAccount,onLibrary,onAchievements,onSettings}:{profile:Profile,stats:Stats,account:PlayerAccountController,onPlay:()=>void,onTour:()=>void,onTutorial:()=>void,onSocial:()=>void,onRanked:()=>void,onMultiplayer:()=>void,onAccount:()=>void,onLibrary:()=>void,onAchievements:()=>void,onSettings:()=>void})");
  const navAnchor='  <nav className="metal-menu-stack" aria-label="Main menu">';
  const tourHero='  <button className="tour-main-cta" onClick={onTour}><span className="tour-main-art"><Trophy/><i>STORY MODE</i></span><span className="tour-main-copy"><small>THE MAIN RHYTHMTAP EXPERIENCE</small><strong>RHYTHMTAP TOUR</strong><em>Start small. Earn stars. Unlock bigger gigs. Become the headliner.</em><b>CONTINUE TOUR <ChevronRight/></b></span></button>\n  <div className="home-learn-strip"><button onClick={onTutorial}><Zap/><span><small>NEW TO RHYTHMTAP?</small><strong>HOW TO PLAY</strong></span><ChevronRight/></button></div>\n'+navAnchor;
  code=replaceRequired(code,'primary tour hero',navAnchor,tourHero);
  const onlineButton='<button className="metal-menu-button metal-menu-online" onClick={onMultiplayer}><span className="metal-menu-icon"><User/></span><span className="metal-menu-copy"><small>LIVE CONNECTION</small><strong>ONLINE BATTLE</strong><em>2-player realtime score battle</em></span><ChevronRight/></button>';
  const featureButtons='<button className="metal-menu-button" onClick={onSocial}><span className="metal-menu-icon"><User/></span><span className="metal-menu-copy"><small>SOCIAL</small><strong>FRIENDS + INVITES</strong><em>Friends online · direct battles</em></span><ChevronRight/></button>\n   <button className="metal-menu-button" onClick={onRanked}><span className="metal-menu-icon"><Award/></span><span className="metal-menu-copy"><small>COMPETITIVE</small><strong>RANKED</strong><em>Battle rating · leaderboards</em></span><ChevronRight/></button>\n   '+onlineButton;
  code=replaceRequired(code,'secondary feature buttons',onlineButton,featureButtons);
  return {code,map:null};
 }};
}
