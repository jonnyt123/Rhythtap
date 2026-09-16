import type {Plugin} from 'vite';

const replaceRequired=(source:string,label:string,before:string,after:string)=>{
 if(!source.includes(before))throw new Error(`[game-wide-hardening] Unable to patch ${label}; transformed layout changed.`);
 return source.replace(before,after);
};

const replaceSection=(source:string,label:string,startMarker:string,endMarker:string,after:string)=>{
 const start=source.indexOf(startMarker),end=start<0?-1:source.indexOf(endMarker,start);
 if(start<0||end<0)throw new Error(`[game-wide-hardening] Unable to patch ${label}; transformed layout changed.`);
 return source.slice(0,start)+after+source.slice(end+endMarker.length);
};

const patchMain=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'synchronous lifecycle state commit',
  "import {createRoot} from 'react-dom/client';",
  "import {flushSync} from 'react-dom';\nimport {createRoot} from 'react-dom/client';");
 code=replaceRequired(code,'tap import limit constant',
  "import {parseTapChart} from './tapChart';",
  "import {MAX_TAP_FILE_BYTES,parseTapChart} from './tapChart';");
 code=replaceRequired(code,'persisted note speed',
  "[speed,setSpeed]=useState(1)",
  "[speed,setSpeed]=useState(()=>{const value=Number(localStorage.getItem('ntr-speed')||1);return Number.isFinite(value)?Math.max(.7,Math.min(1.5,value)):1})");
 code=replaceRequired(code,'persist note speed',
  "speed={speed} setSpeed={setSpeed}",
  "speed={speed} setSpeed={(v)=>{const next=Math.max(.7,Math.min(1.5,v));setSpeed(next);localStorage.setItem('ntr-speed',String(next))}}");
 code=replaceRequired(code,'restore guest progression after sign out',
  "useEffect(()=>{if(!playerAccount.profile)return;setProfile({xp:playerAccount.profile.xp,level:playerAccount.profile.level});setStats(current=>({...current,songsCompleted:playerAccount.profile!.songsCompleted,perfectHits:playerAccount.profile!.perfectHits,bestCombo:playerAccount.profile!.bestCombo}))},[playerAccount.profile?.xp,playerAccount.profile?.level,playerAccount.profile?.songsCompleted,playerAccount.profile?.perfectHits,playerAccount.profile?.bestCombo]);",
  "useEffect(()=>{if(playerAccount.loading)return;if(playerAccount.profile){setProfile({xp:playerAccount.profile.xp,level:playerAccount.profile.level});setStats(current=>({...current,songsCompleted:playerAccount.profile!.songsCompleted,perfectHits:playerAccount.profile!.perfectHits,bestCombo:playerAccount.profile!.bestCombo}));return}setProfile(loadProfile());setStats(loadStats())},[playerAccount.loading,playerAccount.profile?.xp,playerAccount.profile?.level,playerAccount.profile?.songsCompleted,playerAccount.profile?.perfectHits,playerAccount.profile?.bestCombo]);");
 code=replaceRequired(code,'verified battle high score',
  "useEffect(()=>{if(result.progressPending)return;const key=`ntr-high-${song.id}-${difficulty}${difficulty==='HARD'&&!song.id.startsWith('tap-')?'-v5':''}`;localStorage.setItem(key,String(Math.max(result.score,Number(localStorage.getItem(key)||0))))},[result.score,result.progressPending,song.id,difficulty]);",
  "useEffect(()=>{if(result.progressPending||(battle&&verifiedBattle?.validation!=='verified'))return;const finalScore=battle?verifiedBattle!.score:result.score,key=`ntr-high-${song.id}-${difficulty}${difficulty==='HARD'&&!song.id.startsWith('tap-')?'-v5':''}`;localStorage.setItem(key,String(Math.max(finalScore,Number(localStorage.getItem(key)||0))))},[result.score,result.progressPending,song.id,difficulty,battle,verifiedBattle?.score,verifiedBattle?.validation]);");
 code=replaceSection(code,'safari background pause lifecycle',
  "useEffect(()=>{const handleVisibility=()=>{",
  "},[ready,paused]);",
  "useEffect(()=>{const pauseForBackground=()=>{if(!ready||paused)return;backgroundPaused.current=true;pressed.current.clear();transport.current.pause();flushSync(()=>setPaused(true))},handleVisibility=()=>{if(document.hidden)pauseForBackground()};document.addEventListener('visibilitychange',handleVisibility);addEventListener('pagehide',pauseForBackground);return()=>{document.removeEventListener('visibilitychange',handleVisibility);removeEventListener('pagehide',pauseForBackground)}},[ready,paused]);");
 code=replaceRequired(code,'prune stale versioned audio',
  "const cache=await caches.open(AUDIO_CACHE),cached=await cache.match(path);if(cached){",
  "const cache=await caches.open(AUDIO_CACHE),cached=await cache.match(path);if(!cached){const target=new URL(path,location.href),keys=await cache.keys(),stale=keys.filter(request=>{const url=new URL(request.url);return url.origin===target.origin&&url.pathname===target.pathname&&url.href!==target.href});if(stale.length)await Promise.all(stale.map(request=>cache.delete(request)))}if(cached){");
 code=replaceRequired(code,'abortable cached audio helper',
  "const cachedAudioUrl=async(path:string,onProgress:DownloadProgress=()=>{})=>{if(!('caches'in window))return{url:path,objectUrl:false};",
  "const cachedAudioUrl=async(path:string,onProgress:DownloadProgress=()=>{},signal?:AbortSignal)=>{if(signal?.aborted)throw new DOMException('Audio load cancelled','AbortError');if(!('caches'in window))return{url:path,objectUrl:false};");
 code=replaceRequired(code,'abort cached audio fetch',"const response=await fetch(path);","const response=await fetch(path,{signal});");
 code=replaceRequired(code,'import storage quota message',
  "const saveImportedSongs=(songs:Song[])=>localStorage.setItem(IMPORTED_SONGS_KEY,JSON.stringify(songs.filter(song=>song.id.startsWith('tap-'))));",
  "const saveImportedSongs=(songs:Song[])=>{try{localStorage.setItem(IMPORTED_SONGS_KEY,JSON.stringify(songs.filter(song=>song.id.startsWith('tap-'))))}catch(error){if(error instanceof DOMException&&(error.name==='QuotaExceededError'||error.name==='NS_ERROR_DOM_QUOTA_REACHED'))throw new Error('RhythmTap local chart storage is full. Delete an imported chart, then try again.');throw error}};");
 code=replaceRequired(code,'bounded tap import',
  "const importTap=async(file:File)=>{const imported=parseTapChart(await file.text()),notes=imported.notes as Note[],newSong:Song={id:'tap-'+imported.sourceId+'-'+Date.now(),title:imported.title,artist:imported.artist,bpm:120,color:'#69ff9b',root:43,progression:[0,5,3,7],melody:melodyVoltage,unlockLevel:1,duration:imported.duration,charts:{EASY:notes,NORMAL:notes,HARD:notes}};setLibrary(current=>{const next=[...current,newSong];saveImportedSongs(next);return next});setSong(newSong)};",
  "const importTap=async(file:File)=>{if(file.size>MAX_TAP_FILE_BYTES)throw new Error('This .tap file is too large. Keep chart files under 1.5 MB.');const imported=parseTapChart(await file.text()),notes=imported.notes as Note[],newSong:Song={id:'tap-'+imported.sourceId+'-'+Date.now(),title:imported.title,artist:imported.artist,bpm:120,color:'#69ff9b',root:43,progression:[0,5,3,7],melody:melodyVoltage,unlockLevel:1,duration:imported.duration,charts:{EASY:notes,NORMAL:notes,HARD:notes}},next=[...library,newSong];saveImportedSongs(next);setLibrary(next);setSong(newSong)};");
 code=replaceRequired(code,'audio load generation fields',
  "ctx:AudioContext|null=null;source:AudioBufferSourceNode|null=null;media:HTMLAudioElement|null=null;objectUrl='';startAt=0;pausedAt=0;timer:number|undefined;song:Song|null=null;onDownloadProgress:DownloadProgress=()=>{};mediaClockPerf=0;mediaClockMs=0;mediaClockSyncPerf=0;",
  "ctx:AudioContext|null=null;source:AudioBufferSourceNode|null=null;media:HTMLAudioElement|null=null;objectUrl='';startAt=0;pausedAt=0;timer:number|undefined;song:Song|null=null;onDownloadProgress:DownloadProgress=()=>{};mediaClockPerf=0;mediaClockMs=0;mediaClockSyncPerf=0;loadGeneration=0;loadAbort:AbortController|null=null;");
 code=replaceRequired(code,'cancellable media player signature',
  "async playMedia(url:string,from=0,objectUrl=false){const media=new Audio(url);this.media=media;if(objectUrl)this.objectUrl=url;",
  "async playMedia(url:string,from=0,objectUrl=false,generation=this.loadGeneration){if(generation!==this.loadGeneration){if(objectUrl)URL.revokeObjectURL(url);return false}const media=new Audio(url);this.media=media;if(objectUrl)this.objectUrl=url;");
 code=replaceRequired(code,'cancel metadata wait',
  "failed=()=>{cleanup();reject(new Error('Unable to load audio'))}",
  "failed=()=>{cleanup();reject(generation!==this.loadGeneration?new DOMException('Audio load cancelled','AbortError'):new Error('Unable to load audio'))}");
 code=replaceRequired(code,'cancel before media play',
  "media.load()});media.currentTime=Math.min(from/1000,Number.isFinite(media.duration)?Math.max(0,media.duration-.05):from/1000);",
  "media.load()});if(generation!==this.loadGeneration||this.media!==media)return false;media.currentTime=Math.min(from/1000,Number.isFinite(media.duration)?Math.max(0,media.duration-.05):from/1000);");
 code=replaceRequired(code,'cancel media play promise',
  "await media.play();this.pausedAt=media.currentTime*1000;this.mediaClockMs=this.pausedAt;this.mediaClockPerf=performance.now();this.mediaClockSyncPerf=this.mediaClockPerf",
  "try{await media.play()}catch(error){if(generation!==this.loadGeneration)return false;throw error}if(generation!==this.loadGeneration||this.media!==media){media.pause();return false}this.pausedAt=media.currentTime*1000;this.mediaClockMs=this.pausedAt;this.mediaClockPerf=performance.now();this.mediaClockSyncPerf=this.mediaClockPerf;return true");
 code=replaceRequired(code,'cancellable transport start',
  "async start(song:Song,from=0){this.stop();this.song=song;if(song.localAudio){const file=await getStoredAudio(song.id);if(!file)throw new Error(`Audio missing for ${song.title}`);await this.playMedia(URL.createObjectURL(file),from,true);return}if(song.audioFile){const source=await cachedAudioUrl(versionedAudioPath(song.audioFile),this.onDownloadProgress);await this.playMedia(source.url,from,source.objectUrl);return}this.ctx=new AudioContext();await this.ctx.resume();this.startAt=this.ctx.currentTime-from/1000;this.schedule(song,from)}",
  "async start(song:Song,from=0){this.stop();const generation=this.loadGeneration;this.loadAbort=new AbortController();this.song=song;try{if(song.localAudio){const file=await getStoredAudio(song.id);if(generation!==this.loadGeneration)return false;if(!file)throw new Error(`Audio missing for ${song.title}`);return await this.playMedia(URL.createObjectURL(file),from,true,generation)}if(song.audioFile){const source=await cachedAudioUrl(versionedAudioPath(song.audioFile),this.onDownloadProgress,this.loadAbort.signal);if(generation!==this.loadGeneration){if(source.objectUrl)URL.revokeObjectURL(source.url);return false}return await this.playMedia(source.url,from,source.objectUrl,generation)}if(generation!==this.loadGeneration)return false;this.ctx=new AudioContext();await this.ctx.resume();if(generation!==this.loadGeneration){void this.ctx.close();this.ctx=null;return false}this.startAt=this.ctx.currentTime-from/1000;this.schedule(song,from);return true}catch(error){if(generation!==this.loadGeneration||(error instanceof DOMException&&error.name==='AbortError'))return false;throw error}}",
 );
 code=replaceRequired(code,'cancellable preview start',
  "async preview(song:Song){this.stop();this.song=song;if(song.localAudio){const file=await getStoredAudio(song.id);if(!file)throw new Error(`Audio missing for ${song.title}`);await this.playMedia(URL.createObjectURL(file),0,true);return}if(song.previewFile){const source=await cachedAudioUrl(versionedAudioPath(song.previewFile));await this.playMedia(source.url,0,source.objectUrl);return}this.ctx=new AudioContext();await this.ctx.resume();this.startAt=this.ctx.currentTime;this.schedule(song,0)}",
  "async preview(song:Song){this.stop();const generation=this.loadGeneration;this.loadAbort=new AbortController();this.song=song;try{if(song.localAudio){const file=await getStoredAudio(song.id);if(generation!==this.loadGeneration)return false;if(!file)throw new Error(`Audio missing for ${song.title}`);return await this.playMedia(URL.createObjectURL(file),0,true,generation)}if(song.previewFile){const source=await cachedAudioUrl(versionedAudioPath(song.previewFile),()=>{},this.loadAbort.signal);if(generation!==this.loadGeneration){if(source.objectUrl)URL.revokeObjectURL(source.url);return false}return await this.playMedia(source.url,0,source.objectUrl,generation)}if(generation!==this.loadGeneration)return false;this.ctx=new AudioContext();await this.ctx.resume();if(generation!==this.loadGeneration){void this.ctx.close();this.ctx=null;return false}this.startAt=this.ctx.currentTime;this.schedule(song,0);return true}catch(error){if(generation!==this.loadGeneration||(error instanceof DOMException&&error.name==='AbortError'))return false;throw error}}",
 );
 code=replaceRequired(code,'invalidate pending audio loads',
  "stop(){if(this.timer)clearTimeout(this.timer);",
  "stop(){this.loadGeneration++;this.loadAbort?.abort();this.loadAbort=null;if(this.timer)clearTimeout(this.timer);");
 code=replaceRequired(code,'only ready after transport start',
  "try{await transport.current.start(song);setReady(true)}catch{setLoadError('The track could not be loaded. Check your connection and try again.')}",
  "try{const started=await transport.current.start(song);if(started)setReady(true)}catch{setLoadError('The track could not be loaded. Check your connection and try again.')}");
 code=replaceRequired(code,'only mark preview after transport start',
  "try{await preview.current.preview(s);setPreviewing(s.id);",
  "try{const started=await preview.current.preview(s);if(!started)return;setPreviewing(s.id);");
 code=replaceRequired(code,'short local audio completion',
  "const mediaFinished=transport.current.ended()&&t>=notes.at(-1)!.time+TIMING.good;if((t>end||mediaFinished)&&!failedRef.current&&energyRef.current>0){transport.current.stop();const c=countsRef.current,",
  "const mediaFinished=transport.current.ended(),lastNoteEnd=notes.at(-1)!.time+TIMING.good,endedEarly=Boolean(song.localAudio&&mediaFinished&&t<lastNoteEnd);if((t>end||(mediaFinished&&t>=lastNoteEnd)||endedEarly)&&!failedRef.current&&energyRef.current>0){transport.current.stop();const remaining=endedEarly?notes.filter(n=>!judged.current.has(n.id)):[];if(remaining.length){for(const n of remaining){judged.current.add(n.id);soloEvents.current.push({kind:'MISS',noteId:n.id,lane:n.lane,atMs:Math.max(0,Math.round(t))})}}const c=remaining.length?{...countsRef.current,MISS:countsRef.current.MISS+remaining.length}:countsRef.current,");
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

const patchAccount=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'portable account base url',
  "const publicProfileUrl=(username:string)=>`${location.origin}${import.meta.env.BASE_URL}#player/${encodeURIComponent(username)}`;",
  "const appBaseUrl=()=>new URL(import.meta.env.BASE_URL,location.href);\nconst publicProfileUrl=(username:string)=>{const url=appBaseUrl();url.hash=`player/${encodeURIComponent(username)}`;return url.toString()};");
 code=replaceRequired(code,'portable password recovery url',
  "const accountRecoveryUrl=()=>{const url=new URL(`${location.origin}${import.meta.env.BASE_URL}`);url.searchParams.set('recovery','password');return url.toString()};",
  "const accountRecoveryUrl=()=>{const url=appBaseUrl();url.searchParams.set('recovery','password');url.hash='';return url.toString()};");
 code=replaceRequired(code,'portable signup redirect',
  "emailRedirectTo:`${location.origin}${import.meta.env.BASE_URL}`",
  "emailRedirectTo:appBaseUrl().toString()");
 return code;
};

export function gameWideHardeningTransform():Plugin{
 return {name:'rhythtap-game-wide-hardening-transform',enforce:'pre',transform(source,id){
  const normalized=id.replaceAll('\\','/');
  if(normalized.endsWith('/src/main.tsx'))return{code:patchMain(source),map:null};
  if(normalized.endsWith('/src/multiplayer-lobby.tsx'))return{code:patchLobby(source),map:null};
  if(normalized.endsWith('/src/player-account.tsx'))return{code:patchAccount(source),map:null};
  return null;
 }};
}
