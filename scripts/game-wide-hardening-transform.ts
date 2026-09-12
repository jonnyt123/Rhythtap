import type {Plugin} from 'vite';

const replaceRequired=(source:string,label:string,before:string,after:string)=>{
 if(!source.includes(before))throw new Error(`[game-wide-hardening] Unable to patch ${label}; transformed layout changed.`);
 return source.replace(before,after);
};

const patchMain=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'persisted timing settings',
  "[speed,setSpeed]=useState(1),[offset,setOffset]=useState(()=>Number(localStorage.getItem('ntr-offset')||0))",
  "[speed,setSpeed]=useState(()=>{const value=Number(localStorage.getItem('ntr-speed')||1);return Number.isFinite(value)?Math.max(.7,Math.min(1.5,value)):1}),[offset,setOffset]=useState(()=>{const value=Number(localStorage.getItem('ntr-offset')||0);return Number.isFinite(value)?Math.max(-200,Math.min(200,value)):0})");
 code=replaceRequired(code,'persist note speed',
  "speed={speed} setSpeed={setSpeed}",
  "speed={speed} setSpeed={(v)=>{const next=Math.max(.7,Math.min(1.5,v));setSpeed(next);localStorage.setItem('ntr-speed',String(next))}}");
 code=replaceRequired(code,'restore guest progression after sign out',
  "useEffect(()=>{if(!playerAccount.profile)return;setProfile({xp:playerAccount.profile.xp,level:playerAccount.profile.level});setStats(current=>({...current,songsCompleted:playerAccount.profile!.songsCompleted,perfectHits:playerAccount.profile!.perfectHits,bestCombo:playerAccount.profile!.bestCombo}))},[playerAccount.profile?.xp,playerAccount.profile?.level,playerAccount.profile?.songsCompleted,playerAccount.profile?.perfectHits,playerAccount.profile?.bestCombo]);",
  "useEffect(()=>{if(playerAccount.loading)return;if(playerAccount.profile){setProfile({xp:playerAccount.profile.xp,level:playerAccount.profile.level});setStats(current=>({...current,songsCompleted:playerAccount.profile!.songsCompleted,perfectHits:playerAccount.profile!.perfectHits,bestCombo:playerAccount.profile!.bestCombo}));return}setProfile(loadProfile());setStats(loadStats())},[playerAccount.loading,playerAccount.profile?.xp,playerAccount.profile?.level,playerAccount.profile?.songsCompleted,playerAccount.profile?.perfectHits,playerAccount.profile?.bestCombo]);");
 code=replaceRequired(code,'verified battle high score',
  "useEffect(()=>{if(result.progressPending)return;const key=`ntr-high-${song.id}-${difficulty}${difficulty==='HARD'&&!song.id.startsWith('tap-')?'-v5':''}`;localStorage.setItem(key,String(Math.max(result.score,Number(localStorage.getItem(key)||0))))},[result.score,result.progressPending,song.id,difficulty]);",
  "useEffect(()=>{if(result.progressPending||(battle&&verifiedBattle?.validation!=='verified'))return;const finalScore=battle?verifiedBattle!.score:result.score,key=`ntr-high-${song.id}-${difficulty}${difficulty==='HARD'&&!song.id.startsWith('tap-')?'-v5':''}`;localStorage.setItem(key,String(Math.max(finalScore,Number(localStorage.getItem(key)||0))))},[result.score,result.progressPending,song.id,difficulty,battle,verifiedBattle?.score,verifiedBattle?.validation]);");
 code=replaceRequired(code,'prune stale versioned audio',
  "const cache=await caches.open(AUDIO_CACHE),cached=await cache.match(path);if(cached){",
  "const cache=await caches.open(AUDIO_CACHE),cached=await cache.match(path);if(!cached){const target=new URL(path,location.href),keys=await cache.keys(),stale=keys.filter(request=>{const url=new URL(request.url);return url.origin===target.origin&&url.pathname===target.pathname&&url.href!==target.href});if(stale.length)await Promise.all(stale.map(request=>cache.delete(request)))}if(cached){");
 code=replaceRequired(code,'clear all audio cache generations',
  "const clear=async()=>{await caches.delete(AUDIO_CACHE);await refresh()};",
  "const clear=async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('rhythtap-audio-')).map(key=>caches.delete(key)));await refresh()};");
 return code;
};

const patchLobby=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'prune lobby audio versions',
  "const cache=await caches.open(AUDIO_CACHE),cached=await cache.match(path);if(!cached){const response=await fetch(path);",
  "const cache=await caches.open(AUDIO_CACHE),cached=await cache.match(path);if(!cached){const target=new URL(path,location.href),keys=await cache.keys(),stale=keys.filter(request=>{const url=new URL(request.url);return url.origin===target.origin&&url.pathname===target.pathname&&url.href!==target.href});if(stale.length)await Promise.all(stale.map(request=>cache.delete(request)));const response=await fetch(path);");
 return code;
};

export function gameWideHardeningTransform():Plugin{
 return {name:'rhythtap-game-wide-hardening-transform',enforce:'pre',transform(source,id){
  const normalized=id.replaceAll('\\','/');
  if(normalized.endsWith('/src/main.tsx'))return{code:patchMain(source),map:null};
  if(normalized.endsWith('/src/multiplayer-lobby.tsx'))return{code:patchLobby(source),map:null};
  return null;
 }};
}
