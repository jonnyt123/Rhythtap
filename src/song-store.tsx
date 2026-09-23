import React,{useMemo,useState} from 'react';
import {ArrowLeft,Check,Coins,Lock,Music2,ShoppingBag,Sparkles} from 'lucide-react';
import {SONG_STORE_CATALOG,songPrice} from './song-economy';
import './song-store.css';

export type StoreSong={id:string;title:string;artist:string;bpm:number;color:string};
export type StorePurchaseResult={purchased:boolean;message:string;coins:number};

type Props={
 songs:StoreSong[];
 coins:number;
 unlockedSongIds:string[];
 signedIn:boolean;
 playerName:string;
 back:()=>void;
 purchaseSong:(songId:string)=>Promise<StorePurchaseResult>;
};

export function SongShopScreen({songs,coins,unlockedSongIds,signedIn,playerName,back,purchaseSong}:Props){
 const[pending,setPending]=useState(''),[message,setMessage]=useState(''),[reveal,setReveal]=useState<{song:StoreSong;price:number;coins:number}|null>(null);
 const owned=useMemo(()=>new Set(unlockedSongIds),[unlockedSongIds]);
 const songMap=useMemo(()=>new Map(songs.map(song=>[song.id,song])),[songs]);
 const catalog=SONG_STORE_CATALOG.map(entry=>({entry,song:songMap.get(entry.songId)})).filter(item=>Boolean(item.song));
 const buy=async(songId:string)=>{if(pending)return;setPending(songId);setMessage('');try{const result=await purchaseSong(songId);setMessage(result.message);const bought=songMap.get(songId);if(result.purchased&&bought)setReveal({song:bought,price:songPrice(songId),coins:result.coins})}catch(error){setMessage(error instanceof Error?error.message:'Unable to unlock this track.')}finally{setPending('')}};
 return <section className="song-store screen">
  <img className="song-store-texture" src={import.meta.env.BASE_URL+'assets/menu/menu-texture.webp'} alt="" aria-hidden="true"/>
  <header className="song-store-header">
   <button className="song-store-back" onClick={back} aria-label="Back to main menu"><ArrowLeft/></button>
   <div className="song-store-title"><small>RHYTHMTAP</small><h1>SONG STORE</h1></div>
   <div className="song-store-wallet" aria-label={`${coins.toLocaleString()} coins`}><Coins/><span><small>COINS</small><strong>{coins.toLocaleString()}</strong></span></div>
  </header>
  <div className="song-store-scroll">
   <div className="song-store-hero">
    <img src={import.meta.env.BASE_URL+'assets/menu/rhythmtap-logo.webp'} alt="RhythmTap"/>
    <div><small>BUILD YOUR SETLIST</small><h2>UNLOCK MORE TRACKS.</h2><p>Clear songs to earn coins. Spend those coins here to permanently add tracks to your setlist.</p></div>
   </div>
   <div className="song-store-status"><ShoppingBag/><span><small>{signedIn?'CLOUD SETLIST':'GUEST SETLIST'}</small><strong>{signedIn?`${playerName} · unlocks follow your RhythmTap ID`:'Unlocks are saved on this device'}</strong></span></div>
   {message&&<div className="song-store-message" role="status">{message}</div>}
   <div className="song-store-section-title"><span>SETLIST</span><small>{catalog.length} TRACKS · {catalog.filter(({entry})=>entry.starter||owned.has(entry.songId)).length} UNLOCKED</small></div>
   <div className="song-store-list">
    {catalog.map(({entry,song})=>{if(!song)return null;const unlocked=entry.starter||owned.has(entry.songId),price=songPrice(song.id),affordable=coins>=price;return <article className={`song-store-row${unlocked?' owned':' locked'}`} key={song.id} style={{'--store-song':song.color} as React.CSSProperties}>
     <div className="song-store-cover"><Music2/><i/></div>
     <div className="song-store-copy"><small>{song.artist}</small><strong>{song.title}</strong><span>{song.bpm} BPM</span></div>
     <div className="song-store-price">{unlocked?<><Check/><span><small>{entry.starter?'STARTER TRACK':'OWNED'}</small><strong>UNLOCKED</strong></span></>:<><Coins/><span><small>PRICE</small><strong>{price.toLocaleString()}</strong></span></>}</div>
     <button className="song-store-buy" disabled={unlocked||Boolean(pending)||!affordable} onClick={()=>void buy(song.id)} aria-label={unlocked?`${song.title} is unlocked`:affordable?`Unlock ${song.title} for ${price} coins`:`Need ${price-coins} more coins to unlock ${song.title}`}>
      {unlocked?<><Check/> OWNED</>:pending===song.id?'UNLOCKING…':affordable?<><Lock/> UNLOCK</>:<><Lock/> NEED {(price-coins).toLocaleString()}</>}
     </button>
    </article>})}
   </div>
   <div className="song-store-note"><Coins/><div><strong>HOW TO EARN COINS</strong><p>Finish official RhythmTap songs. Better validated runs earn more coins, with every completed official song paying at least 25.</p></div></div>
  </div>
  {reveal&&<div className="song-unlock-overlay" role="dialog" aria-modal="true" aria-labelledby="song-unlock-title">
   <div className="song-unlock-burst" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/></div>
   <div className="song-unlock-card" style={{'--unlock-song':reveal.song.color} as React.CSSProperties}>
    <Sparkles className="song-unlock-spark"/>
    <small>RHYTHMTAP STORE</small>
    <h2 id="song-unlock-title">SONG UNLOCKED</h2>
    <div className="song-unlock-cover"><Music2/><i/></div>
    <strong>{reveal.song.title}</strong>
    <span>{reveal.song.artist}</span>
    <div className="song-unlock-purchase"><Coins/><b>{reveal.price.toLocaleString()}</b><small>COINS SPENT</small></div>
    <div className="song-unlock-balance"><small>NEW BALANCE</small><strong>{reveal.coins.toLocaleString()} COINS</strong></div>
    <button autoFocus onClick={()=>setReveal(null)}><Check/> BACK TO STORE</button>
   </div>
  </div>}
 </section>;
}
