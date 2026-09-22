import type {Plugin} from 'vite';

const replaceRequired=(source:string,label:string,before:string,after:string)=>{
 if(!source.includes(before))throw new Error(`[song-store] Unable to patch ${label}; transformed layout changed.`);
 return source.replace(before,after);
};

const patchMain=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'shop imports',
  "import {MAX_TAP_FILE_BYTES,parseTapChart} from './tapChart';",
  "import {MAX_TAP_FILE_BYTES,parseTapChart} from './tapChart';\nimport {SongShopScreen} from './song-store';\nimport {STARTER_SONG_IDS,awardLocalCoins,isStarterSong,loadLocalSongEconomy,purchaseLocalSong,songPrice} from './song-economy';"
 );
 code=replaceRequired(code,'store screen',"type Screen='home'|","type Screen='home'|'store'|");
 code=replaceRequired(code,'economy state',
  " const playerAccount=usePlayerAccount();",
  " const playerAccount=usePlayerAccount();\n const [localSongEconomy,setLocalSongEconomy]=useState(()=>loadLocalSongEconomy(profile.xp,profile.level));\n const unlockedSongIds=useMemo(()=>[...new Set(playerAccount.userId?[...STARTER_SONG_IDS,...playerAccount.unlockedSongIds]:localSongEconomy.unlockedSongIds)],[playerAccount.userId,playerAccount.unlockedSongIds,localSongEconomy.unlockedSongIds]);\n const coinBalance=playerAccount.userId?(playerAccount.profile?.coins??0):localSongEconomy.coins;\n const isSongUnlocked=useCallback((songId:string)=>songId.startsWith('tap-')||isStarterSong(songId)||unlockedSongIds.includes(songId),[unlockedSongIds]);\n const purchaseSong=useCallback(async(songId:string)=>{if(playerAccount.userId)return playerAccount.purchaseSong(songId);const result=purchaseLocalSong(localSongEconomy,songId);if(result.purchased)setLocalSongEconomy(result.economy);return{purchased:result.purchased,message:result.message,coins:result.economy.coins}},[playerAccount.userId,playerAccount.purchaseSong,localSongEconomy]);"
 );
 code=replaceRequired(code,'guest coin award',
  "setProfile({xp,level});localStorage.setItem('rhythtap-profile',JSON.stringify({xp}));setResult({...r,xpEarned,dailyBonus,levelUp:level>previousLevel,previousLevel,progressPending:false});setScreen('results')",
  "setProfile({xp,level});localStorage.setItem('rhythtap-profile',JSON.stringify({xp}));setLocalSongEconomy(current=>awardLocalCoins(current,xpEarned));setResult({...r,xpEarned,dailyBonus,levelUp:level>previousLevel,previousLevel,progressPending:false});setScreen('results')"
 );
 code=replaceRequired(code,'home store props',
  "profile={profile} stats={stats} account={playerAccount}",
  "profile={profile} stats={stats} account={playerAccount} coins={coinBalance} onStore={()=>setScreen('store')}"
 );
 code=replaceRequired(code,'store screen render',
  "  {screen==='tutorial'&&<RhythmTapTutorial onDone={()=>setScreen('home')}/>}",
  "  {screen==='store'&&<SongShopScreen songs={library.filter(item=>!item.id.startsWith('tap-'))} coins={coinBalance} unlockedSongIds={unlockedSongIds} signedIn={Boolean(playerAccount.userId)} playerName={playerAccount.profile?.displayName||playerAccount.profile?.username||'PLAYER'} back={()=>setScreen('home')} purchaseSong={purchaseSong}/>}\n  {screen==='tutorial'&&<RhythmTapTutorial onDone={()=>setScreen('home')}/> }"
 );
 code=replaceRequired(code,'select ownership props',
  "profile={profile} noteTheme={noteTheme} importTap={importTap}",
  "profile={profile} noteTheme={noteTheme} isSongUnlocked={isSongUnlocked} openStore={()=>setScreen('store')} importTap={importTap}"
 );
 code=replaceRequired(code,'battle ownership props',
  "profileLevel={playerAccount.profile?.level??profile.level} playerId={playerAccount.userId!}",
  "profileLevel={playerAccount.profile?.level??profile.level} unlockedSongIds={unlockedSongIds} playerId={playerAccount.userId!}"
 );
 code=replaceRequired(code,'tour ownership props',
  "<TourSetScreen songs={library} profileLevel={profile.level} userId={playerAccount.userId}",
  "<TourSetScreen songs={library} profileLevel={profile.level} unlockedSongIds={unlockedSongIds} userId={playerAccount.userId}"
 );
 const homeBefore="function Home({profile:localProfile,stats:localStats,account,onPlay,onTour,onTutorial,onSocial,onRanked,onMultiplayer,onAccount,onLibrary,onAchievements,onSettings}:{profile:Profile,stats:Stats,account:PlayerAccountController,onPlay:()=>void,onTour:()=>void,onTutorial:()=>void,onSocial:()=>void,onRanked:()=>void,onMultiplayer:()=>void,onAccount:()=>void,onLibrary:()=>void,onAchievements:()=>void,onSettings:()=>void})";
 const homeAfter="function Home({profile:localProfile,stats:localStats,account,coins,onStore,onPlay,onTour,onTutorial,onSocial,onRanked,onMultiplayer,onAccount,onLibrary,onAchievements,onSettings}:{profile:Profile,stats:Stats,account:PlayerAccountController,coins:number,onStore:()=>void,onPlay:()=>void,onTour:()=>void,onTutorial:()=>void,onSocial:()=>void,onRanked:()=>void,onMultiplayer:()=>void,onAccount:()=>void,onLibrary:()=>void,onAchievements:()=>void,onSettings:()=>void})";
 code=replaceRequired(code,'home store signature',homeBefore,homeAfter);
 code=replaceRequired(code,'wallet coins',
  "<small>XP CREDITS</small><strong>{Math.floor(profile.xp/10).toLocaleString()}</strong>",
  "<small>COINS</small><strong>{coins.toLocaleString()}</strong>"
 );
 code=replaceRequired(code,'player coins',
  "<div className=\"reference-stat-row\"><span>XP CREDITS</span><b>{Math.floor(profile.xp/10).toLocaleString()}</b></div>",
  "<div className=\"reference-stat-row\"><span>COINS</span><b>{coins.toLocaleString()}</b></div>"
 );
 code=replaceRequired(code,'store navigation',
  "<button type=\"button\" className=\"reference-store-button\" onClick={onAccount} aria-label=\"Open RhythmTap Store and billing\"><img className=\"reference-button-surface\" src={import.meta.env.BASE_URL+'assets/menu/button-surface.webp'} alt=\"\" aria-hidden=\"true\"/><Coins/><span><strong>RHYTHMTAP</strong><b>STORE</b><small>PROFILE · PRO · BILLING</small></span></button>",
  "<button type=\"button\" className=\"reference-store-button\" onClick={onStore} aria-label=\"Open RhythmTap Song Store\"><img className=\"reference-button-surface\" src={import.meta.env.BASE_URL+'assets/menu/button-surface.webp'} alt=\"\" aria-hidden=\"true\"/><Coins/><span><strong>RHYTHMTAP</strong><b>STORE</b><small>SETLIST · UNLOCK SONGS</small></span></button>"
 );
 code=replaceRequired(code,'store announcement','More songs available in the setlist.','More songs available in the store.');
 const selectBefore="function Select({songs,song,setSong,difficulty,setDifficulty,profile,noteTheme,importTap,back,play}:{songs:Song[],song:Song,setSong:(s:Song)=>void,difficulty:Difficulty,setDifficulty:(d:Difficulty)=>void,profile:Profile,noteTheme:NoteTheme,importTap:(file:File)=>Promise<void>,back:()=>void,play:()=>void})";
 const selectAfter="function Select({songs,song,setSong,difficulty,setDifficulty,profile,noteTheme,isSongUnlocked,openStore,importTap,back,play}:{songs:Song[],song:Song,setSong:(s:Song)=>void,difficulty:Difficulty,setDifficulty:(d:Difficulty)=>void,profile:Profile,noteTheme:NoteTheme,isSongUnlocked:(songId:string)=>boolean,openStore:()=>void,importTap:(file:File)=>Promise<void>,back:()=>void,play:()=>void})";
 code=replaceRequired(code,'select store signature',selectBefore,selectAfter);
 code=replaceRequired(code,'selected lock state',
  "const leave=(next:()=>void)=>{preview.current.stop();next()};return <section className=\"select screen\">",
  "const leave=(next:()=>void)=>{preview.current.stop();next()},selectedLocked=!song.id.startsWith('tap-')&&!isSongUnlocked(song.id);return <section className=\"select screen\">"
 );
 code=replaceRequired(code,'setlist ownership gate',"const locked=profile.level<s.unlockLevel;","const locked=!s.id.startsWith('tap-')&&!isSongUnlocked(s.id);");
 code=replaceRequired(code,'locked song store action',
  "<button className=\"songpick\" disabled={locked} onClick={()=>setSong(s)}>",
  "<button className=\"songpick\" onClick={()=>{if(locked){openStore();return}setSong(s)}>"
 );
 code=replaceRequired(code,'locked song copy',"{locked?`UNLOCKS AT LEVEL ${s.unlockLevel}`:s.artist}","{locked?`${songPrice(s.id).toLocaleString()} COINS · STORE`:s.artist}");
 code=replaceRequired(code,'locked play action',
  "<button className=\"primary\" onClick={()=>leave(play)}><Play fill=\"currentColor\"/> PLAY</button>",
  "<button className=\"primary\" onClick={()=>selectedLocked?openStore():leave(play)}><Play fill=\"currentColor\"/> {selectedLocked?'STORE':'PLAY'}</button>"
 );
 return code;
};

const patchAccount=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'account economy import',
  "import {getAccountSupabaseClient} from './supabase-account-client';",
  "import {getAccountSupabaseClient} from './supabase-account-client';\nimport {STARTER_SONG_IDS} from './song-economy';"
 );
 code=replaceRequired(code,'cloud coin profile',
  "isPublic:boolean;proBadge:boolean;\n xp:number;level:number;",
  "isPublic:boolean;proBadge:boolean;coins:number;\n xp:number;level:number;"
 );
 code=replaceRequired(code,'purchase result type',
  "export type PlayerAccountController={",
  "export type SongPurchaseResult={purchased:boolean;message:string;coins:number};\nexport type PlayerAccountController={"
 );
 code=replaceRequired(code,'controller store contract',
  "refresh:()=>Promise<void>;recordGame:",
  "refresh:()=>Promise<void>;unlockedSongIds:string[];purchaseSong:(songId:string)=>Promise<SongPurchaseResult>;recordGame:"
 );
 code=replaceRequired(code,'normalize cloud coins',
  "isPublic:Boolean(row.is_public),proBadge:Boolean(row.pro_badge),xp:Number(row.xp)||0,",
  "isPublic:Boolean(row.is_public),proBadge:Boolean(row.pro_badge),coins:row.coins==null?Math.floor((Number(row.xp)||0)/10):Math.max(0,Number(row.coins)||0),xp:Number(row.xp)||0,"
 );
 code=replaceRequired(code,'unlock state',
  "[passwordRecovery,setPasswordRecovery]=useState(()=>new URLSearchParams(location.search).get('recovery')==='password');",
  "[passwordRecovery,setPasswordRecovery]=useState(()=>new URLSearchParams(location.search).get('recovery')==='password'),[unlockedSongIds,setUnlockedSongIds]=useState<string[]>(STARTER_SONG_IDS);"
 );
 code=replaceRequired(code,'unlock loader',
  " const refresh=useCallback(async()=>{",
  " const fetchUnlocks=useCallback(async(client:SupabaseClient,id:string)=>{try{const{data,error:unlockError}=await client.from('player_song_unlocks').select('song_id').eq('user_id',id);if(unlockError)throw unlockError;setUnlockedSongIds([...new Set([...STARTER_SONG_IDS,...(data||[]).map((row:any)=>String(row.song_id))])])}catch(error:any){const message=String(error?.message||error);if(/player_song_unlocks|schema cache|does not exist|PGRST205|42P01/i.test(message)){setUnlockedSongIds(STARTER_SONG_IDS);return}throw error}},[]);\n const refresh=useCallback(async()=>{"
 );
 code=replaceRequired(code,'refresh unlocks',
  "if(session?.user?.id)await fetchProfile(client,session.user.id);else setProfile(null)},[fetchProfile]);",
  "if(session?.user?.id)await Promise.all([fetchProfile(client,session.user.id),fetchUnlocks(client,session.user.id)]);else{setProfile(null);setUnlockedSongIds(STARTER_SONG_IDS)}},[fetchProfile,fetchUnlocks]);"
 );
 code=replaceRequired(code,'auth unlock sync',
  "if(session?.user?.id)void fetchProfile(client,session.user.id);else setProfile(null)",
  "if(session?.user?.id)void Promise.all([fetchProfile(client,session.user.id),fetchUnlocks(client,session.user.id)]);else{setProfile(null);setUnlockedSongIds(STARTER_SONG_IDS)}"
 );
 code=code.replaceAll("setProfile(null);setUserId(null);","setProfile(null);setUnlockedSongIds(STARTER_SONG_IDS);setUserId(null);");
 code=replaceRequired(code,'cloud purchase action',
  " const recordGame=useCallback(async",
  " const purchaseSong=useCallback(async(songId:string):Promise<SongPurchaseResult>=>{if(!userId)return{purchased:false,message:'Sign in to sync song unlocks across devices.',coins:profile?.coins??0};setError('');setNotice('');try{const client=await getAccountClient(),{data,error:purchaseError}=await client.rpc('purchase_song_unlock',{p_song_id:songId});if(purchaseError)throw purchaseError;const row=Array.isArray(data)?data[0]:data,coins=Math.max(0,Number(row?.coin_balance)||0),purchased=Boolean(row?.purchased),message=purchased?'Track unlocked.':row?.already_owned?'Already unlocked.':'Store updated.';await Promise.all([fetchProfile(client,userId),fetchUnlocks(client,userId)]);setNotice(message);return{purchased,message,coins}}catch(error:any){const raw=String(error?.message||error),message=/not enough coins/i.test(raw)?'Not enough coins for that track.':/purchase_song_unlock|schema cache|does not exist|PGRST/i.test(raw)?'Cloud song purchases are not deployed yet.':raw;setError(message);return{purchased:false,message,coins:profile?.coins??0}}},[userId,profile?.coins,fetchProfile,fetchUnlocks]);\n const recordGame=useCallback(async"
 );
 code=replaceRequired(code,'progress coin result',
  "dailyBonus:number;validatedScore:number;",
  "dailyBonus:number;coins:number;coinsAwarded:number;validatedScore:number;"
 );
 code=replaceRequired(code,'progress coin parsing',
  "dailyBonus:Number(row.dailyBonus),validatedScore:Number(validated.score)||0,",
  "dailyBonus:Number(row.dailyBonus),coins:Number.isFinite(Number(row.coins))?Number(row.coins):NaN,coinsAwarded:Number(row.coinsAwarded)||0,validatedScore:Number(validated.score)||0,"
 );
 code=replaceRequired(code,'progress coin profile update',
  "bestCombo:award.bestCombo}:current);return award",
  "bestCombo:award.bestCombo,coins:Number.isFinite(award.coins)?award.coins:current.coins}:current);return award"
 );
 code=replaceRequired(code,'controller store return',
  "return{loading,userId,email,profile,notice,error,passwordRecovery,signUp,signIn,requestPasswordReset,updatePassword,clearPasswordRecovery,signOut,updateProfile,refresh,recordGame,searchProfiles,loadPublicProfile};",
  "return{loading,userId,email,profile,notice,error,passwordRecovery,unlockedSongIds,signUp,signIn,requestPasswordReset,updatePassword,clearPasswordRecovery,signOut,updateProfile,refresh,purchaseSong,recordGame,searchProfiles,loadPublicProfile};"
 );
 code=replaceRequired(code,'account coins stat',
  "<div className=\"account-stats\"><Stat label=\"XP\" value={account.profile.xp.toLocaleString()}/>",
  "<div className=\"account-stats\"><Stat label=\"COINS\" value={account.profile.coins.toLocaleString()}/><Stat label=\"XP\" value={account.profile.xp.toLocaleString()}/>"
 );
 return code;
};

const patchLobby=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'battle unlock signature',
  "export function MultiplayerLobby({songs,profileLevel,playerId,displayName,initialDifficulty,onBack,onLaunch}:{songs:MultiplayerSong[],profileLevel:number,playerId:string,displayName:string,initialDifficulty:MultiplayerDifficulty,onBack:()=>void,onLaunch:(launch:MultiplayerLaunch)=>void}){",
  "export function MultiplayerLobby({songs,profileLevel,unlockedSongIds,playerId,displayName,initialDifficulty,onBack,onLaunch}:{songs:MultiplayerSong[],profileLevel:number,unlockedSongIds:string[],playerId:string,displayName:string,initialDifficulty:MultiplayerDifficulty,onBack:()=>void,onLaunch:(launch:MultiplayerLaunch)=>void}){"
 );
 code=replaceRequired(code,'battle ownership gate',
  "const locked=profileLevel<song.unlockLevel;",
  "const locked=!['voltage','sickness','never-left','fly-eagle'].includes(song.id)&&!unlockedSongIds.includes(song.id);"
 );
 return code;
};

const patchTour=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'tour unlock signature',
  "export function TourSetScreen({songs,profileLevel,userId,back,onPlay}:{songs:TourSong[],profileLevel:number,userId:string|null,back:()=>void,onPlay:(songId:string,difficulty:TourDifficulty,run:TourSetRun)=>void}){",
  "export function TourSetScreen({songs,profileLevel,unlockedSongIds,userId,back,onPlay}:{songs:TourSong[],profileLevel:number,unlockedSongIds:string[],userId:string|null,back:()=>void,onPlay:(songId:string,difficulty:TourDifficulty,run:TourSetRun)=>void}){"
 );
 code=replaceRequired(code,'tour ownership helper',
  " const songMap=useMemo(()=>new Map(songs.map(song=>[song.id,song])),[songs]),progressMap=useMemo",
  " const songUnlocked=(songId:string)=>['voltage','sickness','never-left','fly-eagle'].includes(songId)||unlockedSongIds.includes(songId);\n const songMap=useMemo(()=>new Map(songs.map(song=>[song.id,song])),[songs]),progressMap=useMemo"
 );
 code=replaceRequired(code,'tour start ownership',"profileLevel<song.unlockLevel","!songUnlocked(song.id)");
 code=code.replaceAll("Boolean(nextSong&&profileLevel>=nextSong.unlockLevel)","Boolean(nextSong&&songUnlocked(nextSong.id))");
 code=code.replaceAll("Boolean(song&&profileLevel>=song.unlockLevel)","Boolean(song&&songUnlocked(song.id))");
 code=code.replaceAll(" · UNLOCKS LV ${song.unlockLevel}"," · LOCKED · BUY IN STORE");
 code=code.replaceAll("`REACH LEVEL ${nextSong.unlockLevel} FOR NEXT SONG`","'UNLOCK NEXT SONG IN STORE'");
 code=code.replaceAll("`REACH LV ${nextSong.unlockLevel}`","'BUY IN STORE'");
 return code;
};

export function songStoreTransform():Plugin{
 return{name:'rhythtap-song-store-transform',enforce:'pre',transform(source,id){
  const normalized=id.replaceAll('\\','/');
  if(normalized.endsWith('/src/main.tsx'))return{code:patchMain(source),map:null};
  if(normalized.endsWith('/src/player-account.tsx'))return{code:patchAccount(source),map:null};
  if(normalized.endsWith('/src/multiplayer-lobby.tsx'))return{code:patchLobby(source),map:null};
  if(normalized.endsWith('/src/tour-set-career.tsx'))return{code:patchTour(source),map:null};
  return null;
 }};
}
