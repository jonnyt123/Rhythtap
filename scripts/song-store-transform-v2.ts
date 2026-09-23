import type {Plugin} from 'vite';

const required=(code:string,label:string,before:string,after:string)=>{
 if(!code.includes(before))throw new Error(`[song-store-v2] ${label} marker missing`);
 return code.replace(before,after);
};

const main=(source:string)=>{
 let code=source;
 code=required(code,'imports',"import {MAX_TAP_FILE_BYTES,parseTapChart} from './tapChart';","import {MAX_TAP_FILE_BYTES,parseTapChart} from './tapChart';\nimport {SongShopScreen} from './song-store';\nimport {STARTER_SONG_IDS,awardLocalCoins,coinsForXpAward,isStarterSong,loadLocalSongEconomy,purchaseLocalSong,songPrice} from './song-economy';");
 code=required(code,'screen type',"type Screen='home'|","type Screen='home'|'store'|");
 code=required(code,'economy state'," const playerAccount=usePlayerAccount();"," const playerAccount=usePlayerAccount();\n const [localSongEconomy,setLocalSongEconomy]=useState(()=>loadLocalSongEconomy(profile.xp,profile.level));\n const unlockedSongIds=useMemo(()=>[...new Set(playerAccount.userId?[...STARTER_SONG_IDS,...playerAccount.unlockedSongIds]:localSongEconomy.unlockedSongIds)],[playerAccount.userId,playerAccount.unlockedSongIds,localSongEconomy.unlockedSongIds]);\n const coinBalance=playerAccount.userId?(playerAccount.profile?.coins??0):localSongEconomy.coins;\n const isSongUnlocked=useCallback((songId:string)=>songId.startsWith('tap-')||isStarterSong(songId)||unlockedSongIds.includes(songId),[unlockedSongIds]);\n const purchaseSong=useCallback(async(songId:string)=>{if(playerAccount.userId)return playerAccount.purchaseSong(songId);const result=purchaseLocalSong(localSongEconomy,songId);if(result.purchased)setLocalSongEconomy(result.economy);return{purchased:result.purchased,message:result.message,coins:result.economy.coins}},[playerAccount.userId,playerAccount.purchaseSong,localSongEconomy]);");
 code=required(code,'guest coins',"localStorage.setItem('rhythtap-profile',JSON.stringify({xp}));setResult(","localStorage.setItem('rhythtap-profile',JSON.stringify({xp}));if(official)setLocalSongEconomy(current=>awardLocalCoins(current,xpEarned));setResult(");
 code=required(code,'home props',"profile={profile} stats={stats} account={playerAccount}","profile={profile} stats={stats} account={playerAccount} coins={coinBalance} onStore={()=>setScreen('store')}");
 code=required(code,'store render',"  {screen==='tutorial'","  {screen==='store'&&<SongShopScreen songs={library.filter(item=>!item.id.startsWith('tap-'))} coins={coinBalance} unlockedSongIds={unlockedSongIds} signedIn={Boolean(playerAccount.userId)} playerName={playerAccount.profile?.displayName||playerAccount.profile?.username||'PLAYER'} back={()=>setScreen('home')} purchaseSong={purchaseSong}/>}\n  {screen==='tutorial'");
 code=required(code,'select props',"profile={profile} noteTheme={noteTheme} importTap={importTap}","profile={profile} noteTheme={noteTheme} isSongUnlocked={isSongUnlocked} openStore={()=>setScreen('store')} importTap={importTap}");
 code=required(code,'battle props',"profileLevel={playerAccount.profile?.level??profile.level} playerId={playerAccount.userId!}","profileLevel={playerAccount.profile?.level??profile.level} unlockedSongIds={unlockedSongIds} playerId={playerAccount.userId!}");
 code=required(code,'tour props',"<TourSetScreen songs={library} profileLevel={profile.level} userId={playerAccount.userId}","<TourSetScreen songs={library} profileLevel={profile.level} unlockedSongIds={unlockedSongIds} userId={playerAccount.userId}");
 code=required(code,'home destructure',"function Home({profile:localProfile,stats:localStats,account,","function Home({profile:localProfile,stats:localStats,account,coins,onStore,");
 code=required(code,'home types',"{profile:Profile,stats:Stats,account:PlayerAccountController,onPlay:","{profile:Profile,stats:Stats,account:PlayerAccountController,coins:number,onStore:()=>void,onPlay:");
 code=required(code,'wallet coins',"<small>XP CREDITS</small><strong>{Math.floor(profile.xp/10).toLocaleString()}</strong>","<small>COINS</small><strong>{coins.toLocaleString()}</strong>");
 code=required(code,'stats coins',"<span>XP CREDITS</span><b>{Math.floor(profile.xp/10).toLocaleString()}</b>","<span>COINS</span><b>{coins.toLocaleString()}</b>");
 code=required(code,'store handler',"className=\"reference-store-button\" onClick={onAccount} aria-label=\"Open RhythmTap Store and billing\"","className=\"reference-store-button\" onClick={onStore} aria-label=\"Open RhythmTap Song Store\"");
 code=required(code,'store subcopy','PROFILE · PRO · BILLING','SETLIST · UNLOCK SONGS');
 code=required(code,'announcement','More songs available in the setlist.','More songs available in the store.');
 code=required(code,'select destructure',"function Select({songs,song,setSong,difficulty,setDifficulty,profile,noteTheme,","function Select({songs,song,setSong,difficulty,setDifficulty,profile,noteTheme,isSongUnlocked,openStore,");
 code=required(code,'select types',"profile:Profile,noteTheme:NoteTheme,importTap:","profile:Profile,noteTheme:NoteTheme,isSongUnlocked:(songId:string)=>boolean,openStore:()=>void,importTap:");
 code=required(code,'selected lock',"const leave=(next:()=>void)=>{preview.current.stop();next()};return <section className=\"select screen\">","const leave=(next:()=>void)=>{preview.current.stop();next()},selectedLocked=!song.id.startsWith('tap-')&&!isSongUnlocked(song.id);return <section className=\"select screen\">");
 code=required(code,'song lock',"const locked=profile.level<s.unlockLevel;","const locked=!s.id.startsWith('tap-')&&!isSongUnlocked(s.id);");
 code=required(code,'locked song click',"<button className=\"songpick\" disabled={locked} onClick={()=>setSong(s)}>","<button className=\"songpick\" onClick={()=>{if(locked){openStore();return}setSong(s)}}>");
 code=required(code,'locked song label',"{locked?`UNLOCKS AT LEVEL ${s.unlockLevel}`:s.artist}","{locked?`${songPrice(s.id).toLocaleString()} COINS · STORE`:s.artist}");
 code=required(code,'play lock',"<button className=\"primary\" onClick={()=>leave(play)}><Play fill=\"currentColor\"/> PLAY</button>","<button className=\"primary\" onClick={()=>selectedLocked?openStore():leave(play)}><Play fill=\"currentColor\"/> {selectedLocked?'STORE':'PLAY'}</button>");
 code=required(code,'results coin reward',"<div className=\"xp-award\"><div className=\"xp-award-heading\">","{!battle&&!song.id.startsWith('tap-')&&<div className={'result-coin-reward'+(result.progressPending?' pending':result.progressError?' error':'')} role=\"status\" aria-live=\"polite\"><Coins/><span><small>COINS EARNED</small><strong>{result.progressPending?'VERIFYING…':result.progressError?'NOT SAVED':\`+${coinsForXpAward(result.xpEarned).toLocaleString()}\`}</strong></span></div>}<div className=\"xp-award\"><div className=\"xp-award-heading\">");
 return code;
};

const account=(source:string)=>{
 let code=source;
 code=required(code,'account import',"import {getAccountSupabaseClient} from './supabase-account-client';","import {getAccountSupabaseClient} from './supabase-account-client';\nimport {STARTER_SONG_IDS} from './song-economy';");
 code=required(code,'profile coins',"isPublic:boolean;proBadge:boolean;\n xp:number;level:number;","isPublic:boolean;proBadge:boolean;coins:number;\n xp:number;level:number;");
 code=required(code,'purchase type',"export type PlayerAccountController={","export type SongPurchaseResult={purchased:boolean;message:string;coins:number};\nexport type PlayerAccountController={");
 code=required(code,'controller contract',"refresh:()=>Promise<void>;recordGame:","refresh:()=>Promise<void>;unlockedSongIds:string[];purchaseSong:(songId:string)=>Promise<SongPurchaseResult>;recordGame:");
 code=required(code,'normalize coins',"isPublic:Boolean(row.is_public),proBadge:Boolean(row.pro_badge),xp:Number(row.xp)||0,","isPublic:Boolean(row.is_public),proBadge:Boolean(row.pro_badge),coins:row.coins==null?Math.floor((Number(row.xp)||0)/10):Math.max(0,Number(row.coins)||0),xp:Number(row.xp)||0,");
 code=required(code,'unlock state',"[passwordRecovery,setPasswordRecovery]=useState(()=>new URLSearchParams(location.search).get('recovery')==='password');","[passwordRecovery,setPasswordRecovery]=useState(()=>new URLSearchParams(location.search).get('recovery')==='password'),[unlockedSongIds,setUnlockedSongIds]=useState<string[]>(STARTER_SONG_IDS);");
 code=required(code,'unlock loader'," const refresh=useCallback(async()=>{"," const fetchUnlocks=useCallback(async(client:SupabaseClient,id:string)=>{try{const{data,error:unlockError}=await client.from('player_song_unlocks').select('song_id').eq('user_id',id);if(unlockError)throw unlockError;setUnlockedSongIds([...new Set([...STARTER_SONG_IDS,...(data||[]).map((row:any)=>String(row.song_id))])])}catch(error:any){const message=String(error?.message||error);if(/player_song_unlocks|schema cache|does not exist|PGRST205|42P01/i.test(message)){setUnlockedSongIds(STARTER_SONG_IDS);return}throw error}},[]);\n const refresh=useCallback(async()=>{");
 code=required(code,'refresh profile/unlocks',"if(session?.user?.id)await fetchProfile(client,session.user.id);else setProfile(null)},[fetchProfile]);","if(session?.user?.id)await Promise.all([fetchProfile(client,session.user.id),fetchUnlocks(client,session.user.id)]);else{setProfile(null);setUnlockedSongIds(STARTER_SONG_IDS)}},[fetchProfile,fetchUnlocks]);");
 code=required(code,'auth profile/unlocks',"if(session?.user?.id)void fetchProfile(client,session.user.id);else setProfile(null)","if(session?.user?.id)void Promise.all([fetchProfile(client,session.user.id),fetchUnlocks(client,session.user.id)]);else{setProfile(null);setUnlockedSongIds(STARTER_SONG_IDS)}");
 code=code.replaceAll("setProfile(null);setUserId(null);","setProfile(null);setUnlockedSongIds(STARTER_SONG_IDS);setUserId(null);");
 code=required(code,'purchase action'," const recordGame=useCallback(async"," const purchaseSong=useCallback(async(songId:string):Promise<SongPurchaseResult>=>{if(!userId)return{purchased:false,message:'Sign in to sync song unlocks across devices.',coins:profile?.coins??0};setError('');setNotice('');try{const client=await getAccountClient(),{data,error:purchaseError}=await client.rpc('purchase_song_unlock',{p_song_id:songId});if(purchaseError)throw purchaseError;const row=Array.isArray(data)?data[0]:data,coins=Math.max(0,Number(row?.coin_balance)||0),purchased=Boolean(row?.purchased),message=purchased?'Track unlocked.':row?.already_owned?'Already unlocked.':'Store updated.';await Promise.all([fetchProfile(client,userId),fetchUnlocks(client,userId)]);setNotice(message);return{purchased,message,coins}}catch(error:any){const raw=String(error?.message||error),message=/not enough coins/i.test(raw)?'Not enough coins for that track.':/purchase_song_unlock|schema cache|does not exist|PGRST/i.test(raw)?'Cloud song purchases are not deployed yet.':raw;setError(message);return{purchased:false,message,coins:profile?.coins??0}}},[userId,profile?.coins,fetchProfile,fetchUnlocks]);\n const recordGame=useCallback(async");
 code=required(code,'award type',"dailyBonus:number;validatedScore:number;","dailyBonus:number;coins:number;coinsAwarded:number;validatedScore:number;");
 code=required(code,'award parse',"dailyBonus:Number(row.dailyBonus),validatedScore:Number(validated.score)||0,","dailyBonus:Number(row.dailyBonus),coins:Number.isFinite(Number(row.coins))?Number(row.coins):NaN,coinsAwarded:Number(row.coinsAwarded)||0,validatedScore:Number(validated.score)||0,");
 code=required(code,'profile coin update',"bestCombo:award.bestCombo}:current);return award","bestCombo:award.bestCombo,coins:Number.isFinite(award.coins)?award.coins:current.coins}:current);return award");
 code=required(code,'controller return',"return{loading,userId,email,profile,notice,error,passwordRecovery,signUp,signIn,requestPasswordReset,updatePassword,clearPasswordRecovery,signOut,updateProfile,refresh,recordGame,searchProfiles,loadPublicProfile};","return{loading,userId,email,profile,notice,error,passwordRecovery,unlockedSongIds,signUp,signIn,requestPasswordReset,updatePassword,clearPasswordRecovery,signOut,updateProfile,refresh,purchaseSong,recordGame,searchProfiles,loadPublicProfile};");
 code=required(code,'account stat',"<div className=\"account-stats\"><Stat label=\"XP\" value={account.profile.xp.toLocaleString()}/>","<div className=\"account-stats\"><Stat label=\"COINS\" value={account.profile.coins.toLocaleString()}/><Stat label=\"XP\" value={account.profile.xp.toLocaleString()}/>");
 return code;
};

const lobby=(source:string)=>{
 let code=source;
 code=required(code,'lobby destructure',"export function MultiplayerLobby({songs,profileLevel,playerId,","export function MultiplayerLobby({songs,profileLevel,unlockedSongIds,playerId,");
 code=required(code,'lobby types',"songs:MultiplayerSong[],profileLevel:number,playerId:string,","songs:MultiplayerSong[],profileLevel:number,unlockedSongIds:string[],playerId:string,");
 code=required(code,'lobby lock',"const locked=profileLevel<song.unlockLevel;","const locked=!['voltage','sickness','never-left','fly-eagle'].includes(song.id)&&!unlockedSongIds.includes(song.id);");
 return code;
};

const tour=(source:string)=>{
 let code=source;
 code=required(code,'tour destructure',"export function TourSetScreen({songs,profileLevel,userId,","export function TourSetScreen({songs,profileLevel,unlockedSongIds,userId,");
 code=required(code,'tour types',"songs:TourSong[],profileLevel:number,userId:string|null,","songs:TourSong[],profileLevel:number,unlockedSongIds:string[],userId:string|null,");
 code=required(code,'tour helper'," const songMap=useMemo(()=>new Map(songs.map(song=>[song.id,song])),[songs]),progressMap=useMemo"," const songUnlocked=(songId:string)=>['voltage','sickness','never-left','fly-eagle'].includes(songId)||unlockedSongIds.includes(songId);\n const songMap=useMemo(()=>new Map(songs.map(song=>[song.id,song])),[songs]),progressMap=useMemo");
 code=required(code,'tour start lock',"profileLevel<song.unlockLevel","!songUnlocked(song.id)");
 code=code.replaceAll("Boolean(nextSong&&profileLevel>=nextSong.unlockLevel)","Boolean(nextSong&&songUnlocked(nextSong.id))");
 code=code.replaceAll("Boolean(song&&profileLevel>=song.unlockLevel)","Boolean(song&&songUnlocked(song.id))");
 code=code.replaceAll(" · UNLOCKS LV ${song.unlockLevel}"," · LOCKED · BUY IN STORE");
 code=code.replaceAll("`REACH LEVEL ${nextSong.unlockLevel} FOR NEXT SONG`","'UNLOCK NEXT SONG IN STORE'");
 code=code.replaceAll("`REACH LV ${nextSong.unlockLevel}`","'BUY IN STORE'");
 return code;
};

export function songStoreTransformV2():Plugin{return{name:'rhythtap-song-store-transform-v2',enforce:'pre',transform(source,id){const file=id.replaceAll('\\','/');if(file.endsWith('/src/main.tsx'))return{code:main(source),map:null};if(file.endsWith('/src/player-account.tsx'))return{code:account(source),map:null};if(file.endsWith('/src/multiplayer-lobby.tsx'))return{code:lobby(source),map:null};if(file.endsWith('/src/tour-set-career.tsx'))return{code:tour(source),map:null};return null}}}
