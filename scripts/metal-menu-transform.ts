import type {Plugin} from 'vite';

const HOME_START='function Home({profile:localProfile,stats:localStats,account,onPlay,onMultiplayer,onAccount,onLibrary,onAchievements,onSettings}';
const HOME_END='\nfunction Select(';

const METAL_HOME=String.raw`function Home({profile:localProfile,stats:localStats,account,onPlay,onMultiplayer,onAccount,onLibrary,onAchievements,onSettings}:{profile:Profile,stats:Stats,account:PlayerAccountController,onPlay:()=>void,onMultiplayer:()=>void,onAccount:()=>void,onLibrary:()=>void,onAchievements:()=>void,onSettings:()=>void}){const profile=account.profile?{xp:account.profile.xp,level:account.profile.level}:localProfile,stats=account.profile?{...localStats,songsCompleted:account.profile.songsCompleted,perfectHits:account.profile.perfectHits,bestCombo:account.profile.bestCombo}:localStats,progress=(profile.xp-xpFloor(profile.level))/(xpCeil(profile.level)-xpFloor(profile.level))*100,dailyProgress=Math.min(2,stats.dailyPlays),completedAchievements=achievements.filter(a=>a.value(stats)>=a.target).length,xpCurrent=profile.xp-xpFloor(profile.level),xpNeeded=xpCeil(profile.level)-xpFloor(profile.level),rankLabel=profile.level>=10?'HEADLINER':profile.level>=5?'METALHEAD':profile.level>=3?'RIFF MASTER':'ROAD CREW',displayName=account.profile?.displayName||account.profile?.username||'PLAYER';return <section className="home screen metal-home">
 <img className="reference-menu-texture" src={import.meta.env.BASE_URL+'assets/menu/menu-texture.webp'} alt="" aria-hidden="true"/>
 <div className="metal-stage-bg" aria-hidden="true"><i/><i/><i/></div>
 <header className="topbar metal-status"><span className="brandmark metal-mini-brand"><img className="reference-mini-skull" src={import.meta.env.BASE_URL+'assets/menu/icon-skull.webp'} alt="" aria-hidden="true"/> RHYTHMTAP</span><div className="wallet metal-wallet" title="Progress credits"><Coins/><span><small>XP CREDITS</small><strong>{Math.floor(profile.xp/10).toLocaleString()}</strong></span></div><button className="icon metal-icon" onClick={onSettings} aria-label="Settings"><Settings/></button></header>
 <div className="home-content metal-home-content">
  <div className="metal-logo-block reference-logo-block" aria-label="RhythmTap"><img className="reference-logo-art" src={import.meta.env.BASE_URL+'assets/menu/rhythmtap-logo.webp'} alt="RhythmTap"/></div>
  <div className="reference-announcement" role="status"><img className="reference-announcement-art" src={import.meta.env.BASE_URL+'assets/menu/announcement-bubble.webp'} alt="" aria-hidden="true"/><span>More songs available in the setlist.</span></div>
  <div className="reference-player-grid">
   <button type="button" className="reference-character-slot" onClick={onAccount} aria-label={account.profile?'Open RhythmTap profile':'Sign in to RhythmTap ID'}><span className="reference-character-art" aria-hidden="true"><img src={import.meta.env.BASE_URL+'assets/menu/player-character.webp'} alt=""/></span><small>PLAYER CARD</small></button>
   <div className="reference-player-side">
    <button type="button" className="player-card metal-player-card reference-player-card" onClick={onAccount} aria-label={account.profile?'Open RhythmTap profile':'Sign in to RhythmTap ID'}><img className="reference-panel-art" src={import.meta.env.BASE_URL+'assets/menu/metal-panel.webp'} alt="" aria-hidden="true"/><div className="player-copy"><small>{account.profile?'RHYTHTAP ID · CLOUD SAVE':'GUEST SESSION · LOCAL SAVE'}</small><strong>{displayName}</strong><div className="reference-stat-row"><span>LEVEL</span><b>{profile.level}</b></div><div className="reference-stat-row"><span>XP CREDITS</span><b>{Math.floor(profile.xp/10).toLocaleString()}</b></div><div className="xp-line"><span>{rankLabel}</span><span>{xpCurrent} / {xpNeeded} XP</span></div><div className="xp-track"><i style={{width:progress+'%'}}/></div></div><ChevronRight className="metal-card-chevron"/></button>
    <button type="button" className="reference-store-button" onClick={onAccount} aria-label="Open RhythmTap Store and billing"><img className="reference-button-surface" src={import.meta.env.BASE_URL+'assets/menu/button-surface.webp'} alt="" aria-hidden="true"/><Coins/><span><strong>RHYTHMTAP</strong><b>STORE</b><small>PROFILE · PRO · BILLING</small></span></button>
   </div>
  </div>
  <nav className="metal-menu-stack" aria-label="Main menu">
   <button className="metal-menu-button metal-menu-solo" onClick={onPlay}><img className="reference-play-arch" src={import.meta.env.BASE_URL+'assets/menu/play-arch.webp'} alt="" aria-hidden="true"/><img className="reference-play-button-art" src={import.meta.env.BASE_URL+'assets/menu/play-button.webp'} alt="" aria-hidden="true"/><span className="metal-menu-icon"><Play fill="currentColor"/></span><span className="metal-menu-copy"><small>START A SET</small><strong>SOLO PLAY</strong><em>Choose a song and difficulty</em></span><ChevronRight/></button>
   <button className="metal-menu-button metal-menu-online" onClick={onMultiplayer}><span className="metal-menu-icon"><User/></span><span className="metal-menu-copy"><small>LIVE CONNECTION</small><strong>ONLINE BATTLE</strong><em>2-player realtime score battle</em></span><ChevronRight/></button>
   <button className="metal-menu-button metal-menu-charts" onClick={onLibrary}><img className="reference-button-surface" src={import.meta.env.BASE_URL+'assets/menu/button-surface.webp'} alt="" aria-hidden="true"/><span className="metal-menu-icon reference-menu-art-pair"><img src={import.meta.env.BASE_URL+'assets/menu/icon-users.webp'} alt="" aria-hidden="true"/><img className="reference-editor-badge" src={import.meta.env.BASE_URL+'assets/menu/icon-editor.webp'} alt="" aria-hidden="true"/></span><span className="metal-menu-copy"><small>MY CHARTS · LOCAL LIBRARY</small><strong>USER BEATMAPS</strong><em>Imported tracks · sync tools · personal scores</em></span><ChevronRight/></button>
   <button className="metal-menu-button metal-menu-achievements" onClick={onAchievements}><span className="metal-menu-icon"><Trophy/></span><span className="metal-menu-copy"><small>PROGRESSION</small><strong>ACHIEVEMENTS</strong><em>{completedAchievements} / {achievements.length} earned</em></span><ChevronRight/></button>
   <button className="metal-menu-button metal-menu-profile" onClick={onAccount}><span className="metal-menu-icon"><User/></span><span className="metal-menu-copy"><small>{account.profile?'PUBLIC IDENTITY':'RHYTHTAP ID'}</small><strong>PROFILE</strong><em>{account.profile?('@'+account.profile.username+' · Level '+account.profile.level):'Sign in · Save progression'}</em></span><ChevronRight/></button>
   <button className="metal-menu-button metal-menu-settings" onClick={onSettings}><img className="reference-button-surface" src={import.meta.env.BASE_URL+'assets/menu/button-surface.webp'} alt="" aria-hidden="true"/><span className="metal-menu-icon"><img className="reference-settings-icon" src={import.meta.env.BASE_URL+'assets/menu/icon-settings.webp'} alt="" aria-hidden="true"/></span><span className="metal-menu-copy"><small>GAME SETUP</small><strong>SETTINGS</strong><em>Audio · timing · graphics · controls</em></span><ChevronRight/></button>
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
  code=code.replace(styleAnchor,styleAnchor+"\nimport './metal-menu.css';\nimport './death-metal-theme.css';\nimport './death-metal-polish.css';");
  return {code,map:null};
 }};
}