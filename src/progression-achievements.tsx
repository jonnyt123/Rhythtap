import React,{useEffect,useMemo,useState} from 'react';
import {ArrowLeft,Check,Coins,Lock,Medal,Music2,Sparkles,Target,Trophy,Zap} from 'lucide-react';
import {buildAchievementProgress,normalizeCloudCoinMilestones,parseLocalCoinMilestones,type AchievementMilestone,type MasteryDifficulty} from './achievement-progress';
import {SONG_STORE_CATALOG,type LocalSongEconomy} from './song-economy';
import {getAccountSupabaseClient} from './supabase-account-client';
import {CareerProgressionMap} from './career-progression-map';
import './progression-achievements.css';

type StatsLike={songsCompleted:number;perfectHits:number;bestCombo:number};

const SONG_LABELS:Record<string,{title:string;artist:string;color:string}>={
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

const ratio=(value:number,total:number)=>total<=0?0:Math.min(100,Math.max(0,value/total*100));
const ProgressRing=({value,total,label}:{value:number;total:number;label:string})=>{
 const percent=ratio(value,total);
 return <div className="achievement-ring" style={{'--progress':percent+'%'} as React.CSSProperties}>
  <div><strong>{value}</strong><span>/ {total}</span></div><small>{label}</small>
 </div>;
};

export function ProgressionAchievementsScreen({
 stats,userId,accountLoading,cloudUnlockedSongIds,localEconomy,coins,back,openStore,openSong
}:{
 stats:StatsLike;
 userId:string|null;
 accountLoading:boolean;
 cloudUnlockedSongIds:string[];
 localEconomy:LocalSongEconomy;
 coins:number;
 back:()=>void;
 openStore:()=>void;
 openSong:(songId:string,difficulty:MasteryDifficulty)=>void;
}){
 const[cloudMilestones,setCloudMilestones]=useState<AchievementMilestone[]>([]);
 const[loading,setLoading]=useState(Boolean(userId));
 const[cloudError,setCloudError]=useState('');
 const[view,setView]=useState<'achievements'|'career'>('achievements');
 useEffect(()=>{
  let active=true;
  if(!userId){setCloudMilestones([]);setLoading(false);setCloudError('');return()=>{active=false}};
  setLoading(true);setCloudError('');
  void(async()=>{
   try{
    const client=await getAccountSupabaseClient();
    const{data,error}=await client.from('player_song_coin_milestones')
      .select('song_id,difficulty,milestone,coin_awarded,earned_at')
      .eq('user_id',userId).order('earned_at',{ascending:true});
    if(error)throw error;
    if(active)setCloudMilestones(normalizeCloudCoinMilestones(data||[]));
   }catch(error){
    if(active)setCloudError(error instanceof Error?error.message:'Unable to sync achievement milestones.');
   }finally{if(active)setLoading(false)}
  })();
  return()=>{active=false};
 },[userId]);

 const localMilestones=useMemo(()=>parseLocalCoinMilestones(localEconomy.coinMilestones),[localEconomy.coinMilestones]);
 const milestones=userId&&!cloudError?cloudMilestones:localMilestones;
 const unlockedIds=userId?cloudUnlockedSongIds:localEconomy.unlockedSongIds;
 const progress=useMemo(()=>buildAchievementProgress(milestones,unlockedIds),[milestones,unlockedIds]);
 const legacy=[
  {label:'First Set',detail:'Complete your first track',value:stats.songsCompleted,target:1},
  {label:'Locked In',detail:'Reach a 25-note combo',value:stats.bestCombo,target:25},
  {label:'Perfect Pulse',detail:'Land 100 PERFECT hits',value:stats.perfectHits,target:100},
 ];
 const legacyComplete=legacy.filter(item=>item.value>=item.target).length;
 const syncLabel=accountLoading||loading?'SYNCING…':userId?(cloudError?'LOCAL FALLBACK':'CLOUD SYNCED'):'LOCAL PLAYER';

 if(view==='career')return <CareerProgressionMap progress={progress} coins={coins} back={()=>setView('achievements')} openStore={openStore} openSong={openSong}/>;

 return <section className="progress-achievements screen">
  <header className="progress-achievements-top">
   <button className="icon" onClick={back} aria-label="Back"><ArrowLeft/></button>
   <div><small>CAREER PROGRESSION</small><h2>ACHIEVEMENTS</h2></div>
   <span className={'achievement-sync '+(cloudError?'warning':'')}>{syncLabel}</span>
  </header>
  <div className="progress-achievements-scroll">
   <section className="achievement-hero">
    <div className="achievement-hero-mark"><Trophy/></div>
    <div><small>RHYTHTAP CAREER</small><h1>{progress.earnedMilestones}<span> / {progress.totalMilestones}</span></h1><p>Performance milestones earned across the official setlist.</p></div>
    <div className="achievement-hero-coins"><Coins/><strong>{userId?'CLOUD':'LOCAL'}</strong><small>PROGRESSION</small></div>
   </section>

   {cloudError&&<div className="achievement-sync-note"><Zap/><span><strong>CLOUD MILESTONES UNAVAILABLE</strong><small>Showing this device's local achievement snapshot instead.</small></span></div>}

   <button className="achievement-career-map" onClick={()=>setView('career')}><span><Zap/><i><small>GUIDED PROGRESSION</small><strong>OPEN CAREER MAP</strong><em>See the next song, difficulty and mastery goal to chase.</em></i></span><b>VIEW ROUTE <ArrowLeft/></b></button>

   <div className="achievement-rings" aria-label="Achievement progress summary">
    <ProgressRing value={progress.unlockedSongs} total={progress.totalSongs} label="SONGS"/>
    <ProgressRing value={progress.firstClears} total={progress.totalFirstClears} label="FIRST CLEARS"/>
    <ProgressRing value={progress.sRanks} total={progress.totalSRanks} label="S RANKS"/>
    <ProgressRing value={progress.fullCombos} total={progress.totalFullCombos} label="FULL COMBOS"/>
   </div>

   <section className="achievement-section">
    <div className="achievement-section-title"><div><Music2/><span><small>OFFICIAL SETLIST</small><strong>SONG MASTERY</strong></span></div><b>{progress.unlockedSongs}/{progress.totalSongs} UNLOCKED</b></div>
    <div className="song-mastery-list">{progress.songs.map(song=>{
     const meta=SONG_LABELS[song.songId]||{title:song.songId,artist:'RhythmTap',color:'#a84b2b'};
     const store=SONG_STORE_CATALOG.find(entry=>entry.songId===song.songId)!;
     return <article className={'song-mastery-card '+(song.unlocked?'unlocked':'locked')} style={{'--song':meta.color} as React.CSSProperties} key={song.songId}>
      <div className="song-mastery-art">{song.unlocked?<Music2/>:<Lock/>}<i/></div>
      <div className="song-mastery-copy"><small>{meta.artist}</small><strong>{meta.title}</strong><span>{song.unlocked?(store.starter?'STARTER TRACK':'OWNED'):`${store.price.toLocaleString()} COINS TO UNLOCK`}</span></div>
      <div className="song-mastery-badges">
       <span className={song.firstClear?'earned':''}>{song.firstClear?<Check/>:<Target/>}<b>FIRST</b><em>{song.firstClear?'DONE':'—'}</em></span>
       <span className={song.sRanks===3?'earned':''}><Medal/><b>S RANK</b><em>{song.sRanks}/3</em></span>
       <span className={song.fullCombos===3?'earned':''}><Sparkles/><b>FULL COMBO</b><em>{song.fullCombos}/3</em></span>
      </div>
     </article>;
    })}</div>
   </section>

   <section className="achievement-section legacy-achievements">
    <div className="achievement-section-title"><div><Trophy/><span><small>CAREER STATS</small><strong>FOUNDATION BADGES</strong></span></div><b>{legacyComplete}/{legacy.length} EARNED</b></div>
    <div className="legacy-achievement-grid">{legacy.map((item,index)=>{
     const complete=item.value>=item.target,percent=ratio(item.value,item.target);
     return <article className={complete?'complete':''} key={item.label}>
      <span>{complete?<Check/>:<Trophy/>}</span><div><small>BADGE {String(index+1).padStart(2,'0')}</small><strong>{item.label}</strong><p>{item.detail}</p><i><b style={{width:percent+'%'}}/></i><em>{Math.min(item.value,item.target)} / {item.target}</em></div>
     </article>;
    })}</div>
   </section>
  </div>
 </section>;
}
