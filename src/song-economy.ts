export type SongStoreEntry={songId:string;price:number;starter:boolean;legacyUnlockLevel:number};
export type LocalSongEconomy={version:1;coins:number;unlockedSongIds:string[]};

export const SONG_STORE_CATALOG:SongStoreEntry[]=[
 {songId:'voltage',price:0,starter:true,legacyUnlockLevel:1},
 {songId:'sickness',price:0,starter:true,legacyUnlockLevel:1},
 {songId:'never-left',price:0,starter:true,legacyUnlockLevel:1},
 {songId:'fly-eagle',price:0,starter:true,legacyUnlockLevel:1},
 {songId:'afterglow',price:250,starter:false,legacyUnlockLevel:2},
 {songId:'my-immortal',price:350,starter:false,legacyUnlockLevel:2},
 {songId:'crazy-train',price:400,starter:false,legacyUnlockLevel:2},
 {songId:'kryptonite',price:450,starter:false,legacyUnlockLevel:2},
 {songId:'kill-you',price:650,starter:false,legacyUnlockLevel:3},
 {songId:'gravity',price:800,starter:false,legacyUnlockLevel:4},
 {songId:'through-fire-flames',price:1200,starter:false,legacyUnlockLevel:5},
];

const LOCAL_ECONOMY_KEY='rhythtap-song-economy-v1';
const bySong=new Map(SONG_STORE_CATALOG.map(entry=>[entry.songId,entry]));
export const STARTER_SONG_IDS=SONG_STORE_CATALOG.filter(entry=>entry.starter).map(entry=>entry.songId);
export const songStoreEntry=(songId:string)=>bySong.get(songId)||null;
export const songPrice=(songId:string)=>bySong.get(songId)?.price??0;
export const isOfficialStoreSong=(songId:string)=>bySong.has(songId);
export const isStarterSong=(songId:string)=>Boolean(bySong.get(songId)?.starter);
export const coinsForXpAward=(xpAward:number)=>xpAward<=0?0:Math.min(100,Math.max(25,Math.round(xpAward/15)));

const normalizeUnlocked=(ids:unknown,legacyLevel:number)=>{
 const set=new Set<string>(STARTER_SONG_IDS);
 if(Array.isArray(ids))for(const id of ids)if(typeof id==='string'&&bySong.has(id))set.add(id);
 for(const entry of SONG_STORE_CATALOG)if(legacyLevel>=entry.legacyUnlockLevel)set.add(entry.songId);
 return [...set];
};

export const loadLocalSongEconomy=(legacyXp:number,legacyLevel:number):LocalSongEconomy=>{
 try{
  const raw=localStorage.getItem(LOCAL_ECONOMY_KEY);
  if(raw){const parsed=JSON.parse(raw);return{version:1,coins:Math.max(0,Math.floor(Number(parsed?.coins)||0)),unlockedSongIds:normalizeUnlocked(parsed?.unlockedSongIds,legacyLevel)}};
 }catch{}
 const seeded={version:1 as const,coins:Math.max(0,Math.floor(legacyXp/10)),unlockedSongIds:normalizeUnlocked([],legacyLevel)};
 try{localStorage.setItem(LOCAL_ECONOMY_KEY,JSON.stringify(seeded))}catch{}
 return seeded;
};

export const saveLocalSongEconomy=(economy:LocalSongEconomy)=>{
 const normalized:LocalSongEconomy={version:1,coins:Math.max(0,Math.floor(economy.coins)),unlockedSongIds:normalizeUnlocked(economy.unlockedSongIds,1)};
 try{localStorage.setItem(LOCAL_ECONOMY_KEY,JSON.stringify(normalized))}catch{}
 return normalized;
};

export const awardLocalCoins=(economy:LocalSongEconomy,xpAward:number)=>saveLocalSongEconomy({...economy,coins:economy.coins+coinsForXpAward(xpAward)});

export const purchaseLocalSong=(economy:LocalSongEconomy,songId:string)=>{
 const entry=bySong.get(songId);
 if(!entry)return{economy,message:'That track is not sold in the RhythmTap Store.',purchased:false};
 if(entry.starter||economy.unlockedSongIds.includes(songId))return{economy,message:'Already unlocked.',purchased:false};
 if(economy.coins<entry.price)return{economy,message:`You need ${(entry.price-economy.coins).toLocaleString()} more coins.`,purchased:false};
 const next=saveLocalSongEconomy({...economy,coins:economy.coins-entry.price,unlockedSongIds:[...economy.unlockedSongIds,songId]});
 return{economy:next,message:'Track unlocked.',purchased:true};
};
