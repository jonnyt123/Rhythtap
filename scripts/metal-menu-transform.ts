import type {Plugin} from 'vite';

const HOME_START='function Home({profile:localProfile,stats:localStats,account,onPlay,onMultiplayer,onAccount,onLibrary,onAchievements,onSettings}';
const HOME_END='\nfunction Select(';

const METAL_HOME=String.raw`function Home({profile:localProfile,stats:localStats,account,onPlay,onMultiplayer,onAccount,onLibrary,onAchievements,onSettings}:{profile:Profile,stats:Stats,account:PlayerAccountController,onPlay:()=>void,onMultiplayer:()=>void,onAccount:()=>void,onLibrary:()=>void,onAchievements:()=>void,onSettings:()=>void}){const profile=account.profile?{xp:account.profile.xp,level:account.profile.level}:localProfile,stats=account.profile?{...localStats,songsCompleted:account.profile.songsCompleted,perfectHits:account.profile.perfectHits,bestCombo:account.profile.bestCombo}:localStats,progress=(profile.xp-xpFloor(profile.level))/(xpCeil(profile.level)-xpFloor(profile.level))*100,dailyProgress=Math.min(2,stats.dailyPlays),completedAchievements=achievements.filter(a=>a.value(stats)>=a.target).length,xpCurrent=profile.xp-xpFloor(profile.level),xpNeeded=xpCeil(profile.level)-xpFloor(profile.level),rankLabel=profile.level>=10?'HEADLINER':profile.level>=5?'METALHEAD':profile.level>=3?'RIFF MASTER':'ROAD CREW',displayName=account.profile?.displayName||account.profile?.username||'PLAYER';return <section className="home screen metal-home">
 <div className="metal-stage-bg" aria-hidden="true"><i/><i/><i/></div>
 <header className="topbar metal-status"><span className="brandmark metal-mini-brand"><Zap fill="currentColor"/> RHYTHMTAP</span><div className="wallet metal-wallet" title="Progress credits"><Coins/><span><small>XP CREDITS</small><strong>{Math.floor(profile.xp/10).toLocaleString()}</strong></span></div><button className="icon metal-icon" onClick={onSettings} aria-label="Settings"><Settings/></button></header>
 <div className="home-content metal-home-content">
  <div className="metal-logo-block" aria-label="RhythmTap"><small>THREE-LANE RHYTHM ACTION</small><div className="metal-logo"><Zap fill="currentColor"/><span>RHYTHM</span><b>TAP</b></div><p>TAP THE BEAT <i/> OWN THE STAGE</p></div>
  <button type="button" className="player-card metal-player-card" onClick={onAccount} aria-label={account.profile?'Open RhythmTap profile':'Sign in to RhythmTap ID'}><div className="avatar metal-avatar"><User/></div><div className="player-copy"><small>{account.profile?'RHYTHMTAP ID · CLOUD SAVE':'GUEST SESSION · LOCAL SAVE'}</small><strong>{displayName}</strong><div className="metal-rank-row"><span>LV {profile.level}</span><em>{rankLabel}</em></div><div className="xp-line"><span>LEVEL {profile.level}</span><span>{xpCurrent} / {xpNeeded} XP</span></div><div className="xp-track"><i style={{width:progress+'%'}}/></div></div><ChevronRight className="metal-card-chevron"/></button>
  <nav className="metal-menu-stack" aria-label="Main menu">
   <button className="metal-menu-button metal-menu-solo" onClick={onPlay}><span className="metal-menu-icon"><Play fill="currentColor"/></span><span className="metal-menu-copy"><small>START A SET</small><strong>SOLO PLAY</strong><em>Choose a song and difficulty</em></span><ChevronRight/></button>
   <button className="metal-menu-button metal-menu-online" onClick={onMultiplayer}><span className="metal-menu-icon"><User/></span><span className="metal-menu-copy"><small>LIVE CONNECTION</small><strong>ONLINE BATTLE</strong><em>2-player realtime score battle</em></span><ChevronRight/></button>
   <button className="metal-menu-button" onClick={onLibrary}><span className="metal-menu-icon"><Music2/></span><span className="metal-menu-copy"><small>YOUR LIBRARY</small><strong>MY CHARTS</strong><em>Imported tracks · personal scores</em></span><ChevronRight/></button>
   <button className="metal-menu-button metal-menu-achievements" onClick={onAchievements}><span className="metal-menu-icon"><Trophy/></span><span className="metal-menu-copy"><small>PROGRESSION</small><strong>ACHIEVEMENTS</strong><em>{completedAchievements} / {achievements.length} earned</em></span><ChevronRight/></button>
   <button className="metal-menu-button metal-menu-profile" onClick={onAccount}><span className="metal-menu-icon"><User/></span><span className="metal-menu-copy"><small>{account.profile?'PUBLIC IDENTITY':'RHYTHTAP ID'}</small><strong>PROFILE</strong><em>{account.profile?('@'+account.profile.username+' · Level '+account.profile.level):'Sign in · Save progression'}</em></span><ChevronRight/></button>
   <button className="metal-menu-button metal-menu-settings" onClick={onSettings}><span className="metal-menu-icon"><Settings/></span><span className="metal-menu-copy"><small>GAME SETUP</small><strong>SETTINGS</strong><em>Audio · timing · graphics · controls</em></span><ChevronRight/></button>
  </nav>
  <div className="metal-utility-grid">
   <div className={'daily metal-daily '+(dailyProgress>=2?'complete':'')}><Target/><div><small>DAILY CHALLENGE</small><strong>{dailyProgress>=2?'Reward claimed · +100 XP':'Complete 2 tracks · +100 XP'}</strong><i><b style={{width:(dailyProgress/2*100)+'%'}}/></i></div><span>{dailyProgress}/2</span></div>
   <div className="metal-stage-card"><span><Trophy/></span><div><small>CAREER STATUS</small><strong>{stats.songsCompleted} TRACKS CLEARED</strong><em>{stats.bestCombo} best combo · {completedAchievements}/{achievements.length} achievements</em></div></div>
  </div>
  <footer className="metal-footer"><span>RHYTHTAP · LIVE BUILD</span><button onClick={onSettings}>HELP & SETTINGS <ChevronRight/></button></footer>
 </div>
</section>}
`;

export function metalMenuTransform():Plugin{
 return {name:'rhythtap-metal-menu-transform',enforce:'pre',transform(source,id){
  if(!id.replaceAll('\\','/').endsWith('/src/main.tsx'))return null;
  const start=source.indexOf(HOME_START);
  if(start<0)throw new Error('[metal-menu] Account-integrated Home component was not found.');
  const end=source.indexOf(HOME_END,start);
  if(end<0)throw new Error('[metal-menu] Unable to locate the end of Home; source layout changed.');
  let code=source.slice(0,start)+METAL_HOME+source.slice(end);
  const styleAnchor="import './ux.css';";
  if(!code.includes(styleAnchor))throw new Error('[metal-menu] Unable to locate the UI stylesheet import.');
  code=code.replace(styleAnchor,styleAnchor+"\nimport './metal-menu.css';\nimport './death-metal-theme.css';");
  return {code,map:null};
 }};
}
