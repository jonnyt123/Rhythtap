import React,{useMemo} from 'react';
import {ArrowLeft,Check,ChevronRight,Coins,Lock,Map,Medal,Music2,Sparkles,Target,Trophy,Zap} from 'lucide-react';
import type {AchievementProgressSummary,MasteryDifficulty,SongAchievementProgress} from './achievement-progress';
import {SONG_STORE_CATALOG} from './song-economy';
import './career-progression-map.css';

type CareerGoalKind='unlock'|'first-clear'|'s-rank'|'full-combo'|'mastered';
type CareerGoal={kind:CareerGoalKind;difficulty?:MasteryDifficulty;label:string;detail:string;actionLabel:string};
type RoadNode={song:SongAchievementProgress;goal:CareerGoal;masteryCount:number;masteryTotal:number;masteryPercent:number;current:boolean;price:number};

const SONG_META:Record<string,{title:string;artist:string;color:string}>={
 voltage:{title:'Midnight Voltage',artist:'NOVA//STATIC',color:'#e45a2b'},
 sickness:{title:'Down With the Sickness',artist:'Disturbed',color:'#9cff3d'},
 'never-left':{title:'If You Never Left',artist:'blink-182',color:'#ff704d'},
 'fly-eagle':{title:'Fly Like an Eagle (Metal)',artist:'Licensed recording',color:'#ffd43b'},
 afterglow:{title:'Afterglow Circuit',artist:'Luma Driver',color:'#ff3dad'},
 'my-immortal':{title:'My Immortal',artist:'Evanescence',color:'#a875ff'},
 'crazy-train':{title:'Crazy Train',artist:'Ozzy Osbourne',color:'#ff9b42'},
 kryptonite:{title:'Kryptonite',artist:'3 Doors Down',color:'#5fc6ff'},
 'kill-you':{title:'Kill You',artist:'Eminem',color:'#ff625f'},
 gravity:{title:'Zero Gravity',artist:'Phase Garden',color:'#b650ff'},
 'through-fire-flames':{title:'Through the Fire and Flames',artist:'DragonForce',color:'#ffbd38'}
};

const ORDER:MasteryDifficulty[]=['EASY','NORMAL','HARD'];

const nextGoal=(song:SongAchievementProgress,price:number):CareerGoal=>{
 if(!song.unlocked)return{kind:'unlock',label:'UNLOCK TRACK',detail:`${price.toLocaleString()} coins required`,actionLabel:'OPEN STORE'};
 if(!song.firstClear)return{kind:'first-clear',difficulty:'NORMAL',label:'FIRST CLEAR',detail:'Finish the song on any difficulty',actionLabel:'PLAY NORMAL'};
 for(const difficulty of ORDER){
  if(!song.sRankDifficulties.includes(difficulty))return{kind:'s-rank',difficulty,label:`${difficulty} S RANK`,detail:'Reach 95%+ accuracy',actionLabel:`PLAY ${difficulty}`};
  if(!song.fullComboDifficulties.includes(difficulty))return{kind:'full-combo',difficulty,label:`${difficulty} FULL COMBO`,detail:'Finish with zero misses',actionLabel:`PLAY ${difficulty}`};
 }
 return{kind:'mastered',label:'MASTERED',detail:'All 7 mastery goals complete',actionLabel:'PLAY AGAIN'};
};

const iconFor=(kind:CareerGoalKind)=>{
 if(kind==='unlock')return <Lock/>;
 if(kind==='first-clear')return <Target/>;
 if(kind==='s-rank')return <Medal/>;
 if(kind==='full-combo')return <Sparkles/>;
 return <Trophy/>;
};

export function CareerProgressionMap({
 progress,coins,back,openStore,openSong
}:{
 progress:AchievementProgressSummary;
 coins:number;
 back:()=>void;
 openStore:()=>void;
 openSong:(songId:string,difficulty:MasteryDifficulty)=>void;
}){
 const route=useMemo(()=>{
  const nodes:RoadNode[]=progress.songs.map(song=>{
   const entry=SONG_STORE_CATALOG.find(item=>item.songId===song.songId)!;
   const masteryCount=(song.firstClear?1:0)+song.sRanks+song.fullCombos;
   return{song,goal:nextGoal(song,entry.price),masteryCount,masteryTotal:7,masteryPercent:masteryCount/7*100,current:false,price:entry.price};
  });
  const nextIndex=Math.max(0,nodes.findIndex(node=>node.goal.kind!=='mastered'));
  if(nodes[nextIndex])nodes[nextIndex]={...nodes[nextIndex],current:true};
  return nodes;
 },[progress]);

 const current=route.find(node=>node.current)??route[route.length-1];
 const currentMeta=SONG_META[current.song.songId]??{title:current.song.songId,artist:'RhythmTap',color:'#b24e2b'};
 const careerPercent=progress.totalMilestones?Math.round(progress.earnedMilestones/progress.totalMilestones*100):0;
 const action=()=>{
  if(current.goal.kind==='unlock'){openStore();return}
  openSong(current.song.songId,current.goal.difficulty??'HARD');
 };

 return <section className="career-map screen">
  <header className="career-map-top">
   <button className="icon" onClick={back} aria-label="Back to achievements"><ArrowLeft/></button>
   <div><small>SETLIST PROGRESSION</small><h2>CAREER MAP</h2></div>
   <span><Map/> {careerPercent}%</span>
  </header>

  <div className="career-map-scroll">
   <section className="career-next" style={{'--song':currentMeta.color} as React.CSSProperties}>
    <div className="career-next-kicker"><Zap/><span><small>RECOMMENDED NEXT</small><strong>{current.goal.label}</strong></span></div>
    <div className="career-next-main">
     <div><small>{currentMeta.artist}</small><h1>{currentMeta.title}</h1><p>{current.goal.detail}</p></div>
     <div className="career-next-wallet"><Coins/><strong>{coins.toLocaleString()}</strong><small>COINS</small></div>
    </div>
    <div className="career-next-progress"><span><i style={{width:current.masteryPercent+'%'}}/></span><b>{current.masteryCount}/7 MASTERY</b></div>
    <button className="career-primary" onClick={action}>{iconFor(current.goal.kind)} {current.goal.actionLabel}<ChevronRight/></button>
   </section>

   <section className="career-overview">
    <div><small>SONGS OWNED</small><strong>{progress.unlockedSongs}<span>/{progress.totalSongs}</span></strong></div>
    <div><small>FIRST CLEARS</small><strong>{progress.firstClears}<span>/{progress.totalFirstClears}</span></strong></div>
    <div><small>S RANKS</small><strong>{progress.sRanks}<span>/{progress.totalSRanks}</span></strong></div>
    <div><small>FULL COMBOS</small><strong>{progress.fullCombos}<span>/{progress.totalFullCombos}</span></strong></div>
   </section>

   <div className="career-route-heading"><div><Map/><span><small>RECOMMENDED ROUTE</small><strong>MASTER THE SETLIST</strong></span></div><b>7 GOALS PER SONG</b></div>

   <div className="career-route" aria-label="Career setlist progression">
    {route.map((node,index)=>{
     const meta=SONG_META[node.song.songId]??{title:node.song.songId,artist:'RhythmTap',color:'#b24e2b'};
     const mastered=node.goal.kind==='mastered';
     return <article className={'career-node '+(mastered?'mastered ':node.current?'current ':node.song.unlocked?'available ':'locked ')+(index%2?'right':'left')} style={{'--song':meta.color} as React.CSSProperties} key={node.song.songId}>
      <div className="career-node-marker"><span>{mastered?<Check/>:node.song.unlocked?<Music2/>:<Lock/>}</span><i/></div>
      <div className="career-node-card">
       <div className="career-node-title"><span><small>SET {String(index+1).padStart(2,'0')} · {node.song.unlocked?'AVAILABLE':'LOCKED'}</small><strong>{meta.title}</strong><em>{meta.artist}</em></span><b>{node.masteryCount}/7</b></div>
       <div className="career-node-meter"><i style={{width:node.masteryPercent+'%'}}/></div>
       <div className="career-node-badges">
        <span className={node.song.firstClear?'done':''}><Target/><b>FIRST</b><em>{node.song.firstClear?'1/1':'0/1'}</em></span>
        <span className={node.song.sRanks===3?'done':''}><Medal/><b>S RANK</b><em>{node.song.sRanks}/3</em></span>
        <span className={node.song.fullCombos===3?'done':''}><Sparkles/><b>FULL COMBO</b><em>{node.song.fullCombos}/3</em></span>
       </div>
       <div className="career-node-goal">
        {iconFor(node.goal.kind)}
        <span><small>{node.current?'NEXT GOAL':mastered?'STATUS':'UP NEXT'}</small><strong>{node.goal.label}</strong><em>{node.goal.detail}</em></span>
       </div>
       {node.current&&<button onClick={action}>{node.goal.actionLabel}<ChevronRight/></button>}
      </div>
     </article>;
    })}
   </div>
  </div>
 </section>;
}
