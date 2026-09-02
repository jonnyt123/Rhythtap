import React,{useEffect,useMemo,useState} from 'react';
import {ArrowLeft,Check,ChevronRight,Gamepad2,Medal,Music2,Star,Swords,Trophy,User,Users,Zap} from 'lucide-react';
import './rhythmtap-tutorial.css';

export const TUTORIAL_KEY='rhythtap-tutorial-complete-v1';
export const tutorialComplete=()=>localStorage.getItem(TUTORIAL_KEY)==='1';
export const markTutorialComplete=()=>localStorage.setItem(TUTORIAL_KEY,'1');

type Lane=0|1|2;
type DemoMode='tap'|'hold';
const laneLabels=['LEFT','CENTER','RIGHT'];

export function RhythmTapTutorial({onDone}:{onDone:()=>void}){
 const[step,setStep]=useState(0),[lane,setLane]=useState<Lane>(1),[hits,setHits]=useState(0),[mode,setMode]=useState<DemoMode>('tap'),[holding,setHolding]=useState(false),[feedback,setFeedback]=useState('');
 const totalSteps=6;
 useEffect(()=>{if(step===1){setHits(0);setMode('tap');setLane(1);setFeedback('');setHolding(false)}if(step===2){setHits(0);setMode('hold');setLane(0);setFeedback('');setHolding(false)}},[step]);
 const finish=()=>{markTutorialComplete();onDone()};
 const next=()=>step>=totalSteps-1?finish():setStep(value=>value+1);
 const tapLane=(nextLane:Lane)=>{
  if(step!==1||mode!=='tap')return;
  if(nextLane!==lane){setFeedback('MISS — TAP THE LANE UNDER THE NOTE');return}
  const nextHits=hits+1;setHits(nextHits);setFeedback(nextHits>=3?'NICE — YOU GOT IT':'PERFECT');setLane(((lane+1)%3) as Lane);
 };
 const startHold=(nextLane:Lane)=>{if(step!==2||nextLane!==lane)return;setHolding(true);setFeedback('KEEP HOLDING…')};
 const endHold=(nextLane:Lane)=>{if(step!==2||nextLane!==lane||!holding)return;setHolding(false);const nextHits=hits+1;setHits(nextHits);setFeedback('HOLD COMPLETE');setLane(((lane+2)%3) as Lane)};
 const canContinue=step===1?hits>=3:step===2?hits>=2:true;
 const progress=((step+1)/totalSteps)*100;
 return <section className="tutorial-screen screen">
  <header className="tutorial-top"><button className="icon" onClick={finish} aria-label="Exit tutorial"><ArrowLeft/></button><div><small>HOW TO PLAY</small><h2>RHYTHMTAP TRAINING</h2></div><span>{step+1}/{totalSteps}</span></header>
  <div className="tutorial-progress"><i style={{width:progress+'%'}}/></div>
  <main className="tutorial-wrap">
   {step===0&&<Intro/>}
   {step===1&&<PlayDemo lane={lane} mode="tap" hits={hits} holding={holding} feedback={feedback} onTap={tapLane} onStart={startHold} onEnd={endHold}/>} 
   {step===2&&<PlayDemo lane={lane} mode="hold" hits={hits} holding={holding} feedback={feedback} onTap={tapLane} onStart={startHold} onEnd={endHold}/>} 
   {step===3&&<JudgmentStep/>}
   {step===4&&<TourStep/>}
   {step===5&&<FeaturesStep/>}
  </main>
  <footer className="tutorial-footer"><div><strong>{step===0?'THE BASICS':step===1?'TAP NOTES':step===2?'HOLD NOTES':step===3?'TIMING':step===4?'STORY MODE':'THE REST OF RHYTHMTAP'}</strong><small>{step===1&&!canContinue?'Hit 3 notes to continue':step===2&&!canContinue?'Complete 2 holds to continue':'Short, playable training — no score pressure'}</small></div><button className="primary" disabled={!canContinue} onClick={next}>{step===totalSteps-1?'START PLAYING':'NEXT'} <ChevronRight/></button></footer>
 </section>;
}

function Intro(){return <div className="tutorial-card intro-card"><div className="tutorial-logo"><Zap fill="currentColor"/></div><small>WELCOME TO RHYTHMTAP</small><h1>FOLLOW THE NOTES.<br/><i>HIT THE BEAT.</i></h1><p>Notes fall down one of three lanes. Your job is simple: tap the matching lane when the note reaches the hit line.</p><div className="three-rules"><span><b>1</b> WATCH</span><span><b>2</b> MATCH</span><span><b>3</b> TAP</span></div></div>}

function PlayDemo({lane,mode,hits,holding,feedback,onTap,onStart,onEnd}:{lane:Lane,mode:DemoMode,hits:number,holding:boolean,feedback:string,onTap:(lane:Lane)=>void,onStart:(lane:Lane)=>void,onEnd:(lane:Lane)=>void}){
 const noteKey=useMemo(()=>`${lane}-${hits}-${mode}`,[lane,hits,mode]);
 return <div className="tutorial-play-card"><div className="tutorial-copy"><small>{mode==='tap'?'TAP NOTES':'HOLD NOTES'}</small><h1>{mode==='tap'?'TAP AS IT CROSSES THE LINE':'PRESS, HOLD, THEN RELEASE'}</h1><p>{mode==='tap'?'Watch which lane the note is falling through, then tap that lane near the target line.':'Long notes have a tail. Keep your finger down until the tail finishes.'}</p></div><div className="demo-stage"><div className="demo-lanes">{([0,1,2] as Lane[]).map(index=><div className="demo-lane" key={index}><span>{laneLabels[index]}</span>{index===lane&&<div key={noteKey} className={'demo-note '+(mode==='hold'?'hold':'')}><i/></div>}</div>)}</div><div className="demo-hit-line"/><div className="demo-pads">{([0,1,2] as Lane[]).map(index=><button key={index} className={holding&&index===lane?'pressed':''} onClick={()=>onTap(index)} onPointerDown={()=>onStart(index)} onPointerUp={()=>onEnd(index)} onPointerCancel={()=>onEnd(index)}><span/></button>)}</div></div><div className="tutorial-feedback"><strong>{feedback||'WATCH THE NOTE FALL'}</strong><span>{hits} / {mode==='tap'?3:2}</span></div></div>;
}

function JudgmentStep(){return <div className="tutorial-card"><small>YOUR TIMING MATTERS</small><h1>THE CLOSER TO THE LINE,<br/><i>THE BETTER THE HIT.</i></h1><div className="judgment-demo"><span><b>PERFECT</b><small>Right on the beat</small></span><span><b>GREAT</b><small>Very close</small></span><span><b>GOOD</b><small>Still counts</small></span><span><b>MISS</b><small>Too early or late</small></span></div><p>Build a combo by avoiding misses. Accuracy, combo and score all improve when your timing gets tighter.</p></div>}

function TourStep(){return <div className="tutorial-card tour-story-card"><div className="story-badge"><Trophy/></div><small>THE MAIN GAME</small><h1>RHYTHMTAP TOUR</h1><p>This is the story/career mode. Start small, clear gigs, earn up to three stars per performance, and unlock bigger stages until you reach the final headliner.</p><div className="story-route"><span><i>1</i><b>BASEMENT</b></span><em/><span><i>★</i><b>EARN STARS</b></span><em/><span><i>8</i><b>HEADLINER</b></span></div><div className="story-tip"><Star fill="currentColor"/><span><strong>BETTER ACCURACY = MORE STARS</strong><small>You can replay gigs to improve your result.</small></span></div></div>}

function FeaturesStep(){return <div className="tutorial-card"><small>WHEN YOU'RE READY</small><h1>THERE'S MORE THAN THE TOUR.</h1><div className="feature-grid"><Feature icon={<Music2/>} title="SOLO PLAY" text="Play any unlocked song without affecting your Tour path."/><Feature icon={<Swords/>} title="ONLINE BATTLE" text="Race another player live using the same charts and scoring."/><Feature icon={<Users/>} title="FRIENDS" text="Add RhythmTap IDs, see who's online, and send direct battle invites."/><Feature icon={<Medal/>} title="RANKED" text="Climb competitive ratings and compare song leaderboard scores."/><Feature icon={<User/>} title="PROFILE" text="Your RhythmTap ID stores progression, scores, stats and public identity."/><Feature icon={<Gamepad2/>} title="REPLAY TUTORIAL" text="Open How To Play from the home screen whenever you want a refresher."/></div></div>}
function Feature({icon,title,text}:{icon:React.ReactNode,title:string,text:string}){return <div className="feature-item"><span>{icon}</span><div><strong>{title}</strong><small>{text}</small></div></div>}
