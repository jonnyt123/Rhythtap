import type {CSSProperties} from 'react';
import {Crown,Swords,Trophy,WifiOff} from 'lucide-react';
import type {MultiplayerSession} from './multiplayer-common';

const scoreText=(value:number)=>Math.max(0,Math.round(value)).toLocaleString();

export function MultiplayerHud({session,localScore}:{session:MultiplayerSession,localScore:number}){
 if(!session.enabled)return null;
 const opponent=session.opponent;
 const opponentScore=opponent?.score??0;
 const gap=localScore-opponentScore;
 const closeRace=Boolean(opponent)&&Math.abs(gap)<1000;
 const total=Math.max(1,localScore+opponentScore);
 const rawShare=opponent?localScore/total*100:50;
 const youShare=Math.max(14,Math.min(86,rawShare));
 const leadLabel=!opponent?'RIVAL JOINING':closeRace?'NECK & NECK':gap>0?`YOU LEAD +${scoreText(gap)}`:`DOWN ${scoreText(Math.abs(gap))}`;
 const stateClass=!opponent?'waiting':closeRace?'even':gap>0?'ahead':'behind';
 const connectionIssue=session.reconnecting||!session.connected;
 const style={'--you-share':`${youShare}%`} as CSSProperties;
 return <div className={'mp-game-hud-v2 '+stateClass} style={style}>
  {connectionIssue&&<div className="mp-battle-alert"><WifiOff/><strong>REJOINING THE BATTLE…</strong></div>}
  <div className="mp-race-head">
   <div className="mp-racer you"><small>YOU</small><strong>{scoreText(localScore)}</strong></div>
   <div className="mp-lead-chip">{gap>0&&!closeRace?<Crown/>:<Swords/>}<span>{leadLabel}</span></div>
   <div className="mp-racer rival"><small>{opponent?.name||'RIVAL'}</small><strong>{opponent?scoreText(opponentScore):'—'}</strong></div>
  </div>
  <div className="mp-race-track" aria-label={opponent?`You have ${scoreText(localScore)} points. ${opponent.name} has ${scoreText(opponentScore)} points.`:'Waiting for rival score'}><i/><b/></div>
  <div className="mp-race-foot"><span>YOUR RUN</span><strong>{opponent?`${opponent.combo}× RIVAL COMBO`:'GET READY'}</strong><span>{session.opponentBackgrounded?'RIVAL AWAY':'LIVE BATTLE'}</span></div>
 </div>;
}

export function MultiplayerResultOverlay({session,localScore}:{session:MultiplayerSession,localScore:number}){
 if(!session.enabled)return null;
 const opponent=session.opponent;
 const localConfirmed=session.verifiedLocal?.validation==='verified';
 const opponentConfirmed=opponent?.validation==='verified';
 const official=Boolean(localConfirmed&&opponent?.finished&&opponentConfirmed);
 const verifiedScore=localConfirmed?session.verifiedLocal!.score:localScore;
 const won=official?verifiedScore>opponent!.score:null;
 const draw=official&&verifiedScore===opponent!.score;
 const failed=session.verifiedLocal?.validation==='unverified';
 const headline=official?(won?'YOU WON':draw?'DRAW':'RIVAL WINS'):failed?'BATTLE NOT COUNTED':'FINALIZING BATTLE…';
 const kicker=official?'ONLINE BATTLE COMPLETE':failed?'YOUR SCORE COULDN’T BE CONFIRMED':opponent?.finished?'CHECKING THE FINAL SCORES':'WAITING FOR YOUR RIVAL';
 const icon=official&&won?<Trophy/>:<Swords/>;
 const rematch=session.localRematch&&session.opponentRematch?'REMATCH LOCKED IN':session.localRematch?'YOU’RE READY FOR A REMATCH':session.opponentRematch?'RIVAL WANTS A REMATCH':'';
 return <div className={'mp-result-overlay-v2 '+(official?(won?'win':draw?'draw':'loss'):failed?'failed':'pending')}>
  <div className="mp-result-icon">{icon}</div>
  <div className="mp-result-copy"><small>{kicker}</small><strong>{headline}</strong>{opponent&&<em>{scoreText(verifiedScore)} <b>—</b> {scoreText(opponent.score)} · {opponent.name}</em>}{rematch&&<span>{rematch}</span>}</div>
 </div>;
}
