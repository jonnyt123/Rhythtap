import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,Copy,LoaderCircle,Play,Radio,RefreshCw,Users,Wifi,WifiOff,Zap} from 'lucide-react';
import './multiplayer.css';

export type MultiplayerDifficulty='EASY'|'NORMAL'|'HARD';
export type MultiplayerSong={id:string,title:string,artist:string,unlockLevel:number,audioFile?:string,charts:Record<MultiplayerDifficulty,unknown[]>};
export type MultiplayerLaunch={roomCode:string,playerId:string,displayName:string,isHost:boolean,songId:string,difficulty:MultiplayerDifficulty,startAt:number};
export type MultiplayerProgress={playerId:string,name:string,score:number,combo:number,accuracy:number,finished?:boolean};
export type MultiplayerSession={enabled:boolean,launch:MultiplayerLaunch|null,connected:boolean,opponent:MultiplayerProgress|null,localRematch:boolean,opponentRematch:boolean,publishProgress:(progress:Omit<MultiplayerProgress,'playerId'|'name'>)=>void,publishFinal:(progress:Omit<MultiplayerProgress,'playerId'|'name'|'finished'>)=>void,requestRematch:()=>void};

type RealtimeChannel=any;
type SupabaseClient=any;

const SUPABASE_URL='https://hcaawhtkldabetxzptmc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_BKpgSL6_ZJHb7N0b-63HbA_GcgswEN8';
const SUPABASE_ESM='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const DISPLAY_NAME_KEY='rhythtap-multiplayer-name';
const AUDIO_CACHE='rhythtap-audio-v1';
const ROOM_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

let clientPromise:Promise<SupabaseClient>|null=null;
const getClient=()=>{
 if(clientPromise)return clientPromise;
 clientPromise=(async()=>{
  const importer=new Function('url','return import(url)') as (url:string)=>Promise<any>;
  const module=await importer(SUPABASE_ESM);
  return module.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},realtime:{params:{eventsPerSecond:12}}});
 })();
 return clientPromise;
};

const makeCode=()=>Array.from({length:6},()=>ROOM_CHARS[Math.floor(Math.random()*ROOM_CHARS.length)]).join('');
const cleanCode=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
const playerId=()=>crypto.randomUUID?.()??('p-'+Math.random().toString(36).slice(2)+Date.now().toString(36));
const flattenPresence=(state:Record<string,any[]>)=>Object.values(state).flat().filter(Boolean);

export function MultiplayerLobby({songs,profileLevel,initialDifficulty,onBack,onLaunch}:{songs:MultiplayerSong[],profileLevel:number,initialDifficulty:MultiplayerDifficulty,onBack:()=>void,onLaunch:(launch:MultiplayerLaunch)=>void}){
 const [name,setName]=useState(()=>localStorage.getItem(DISPLAY_NAME_KEY)||'PLAYER');
 const [code,setCode]=useState('');
 const [roomCode,setRoomCode]=useState('');
 const [isHost,setIsHost]=useState(false);
 const [songId,setSongId]=useState(()=>songs.find(song=>profileLevel>=song.unlockLevel)?.id??songs[0]?.id??'');
 const [difficulty,setDifficulty]=useState<MultiplayerDifficulty>(initialDifficulty);
 const [players,setPlayers]=useState<any[]>([]);
 const [audioReady,setAudioReady]=useState(false);
 const [status,setStatus]=useState<'idle'|'connecting'|'connected'|'error'|'full'>('idle');
 const [message,setMessage]=useState('');
 const idRef=useRef(playerId());
 const channelRef=useRef<RealtimeChannel|null>(null);
 const clientRef=useRef<SupabaseClient|null>(null);
 const hostRef=useRef(false);
 const launchRef=useRef(onLaunch);launchRef.current=onLaunch;
 const selectedSong=useMemo(()=>songs.find(song=>song.id===songId)??songs[0],[songs,songId]);
 const opponentCount=Math.max(0,players.filter(player=>player.playerId!==idRef.current).length);
 const bothReady=players.length===2&&players.every(player=>player.ready===true);

 const cleanup=useCallback(async()=>{
  const channel=channelRef.current;channelRef.current=null;
  if(channel){try{await channel.untrack()}catch{}try{await clientRef.current?.removeChannel(channel)}catch{}}
 },[]);
 useEffect(()=>()=>{void cleanup()},[cleanup]);

 const ensureAudio=useCallback(async(song:MultiplayerSong|undefined)=>{
  setAudioReady(false);if(!song){return}if(!song.audioFile){setAudioReady(true);return}
  const path=import.meta.env.BASE_URL+song.audioFile;
  try{
   if('caches'in window){const cache=await caches.open(AUDIO_CACHE),cached=await cache.match(path);if(!cached){const response=await fetch(path);if(!response.ok)throw new Error('Unable to prepare track');await cache.put(path,response.clone())}}
   else{const response=await fetch(path,{cache:'force-cache'});if(!response.ok)throw new Error('Unable to prepare track')}
   setAudioReady(true);
  }catch{setAudioReady(false);setMessage('TRACK DOWNLOAD FAILED — CHECK YOUR CONNECTION')}
 },[]);
 useEffect(()=>{if(roomCode&&status==='connected')void ensureAudio(selectedSong)},[roomCode,status,selectedSong?.id,ensureAudio]);

 const presencePayload=useCallback(()=>({playerId:idRef.current,name:(name.trim()||'PLAYER').slice(0,18),isHost:hostRef.current,songId,difficulty,ready:audioReady,joinedAt:Date.now()}),[name,songId,difficulty,audioReady]);
 useEffect(()=>{localStorage.setItem(DISPLAY_NAME_KEY,(name.trim()||'PLAYER').slice(0,18));const channel=channelRef.current;if(channel&&status==='connected')void channel.track(presencePayload())},[name,songId,difficulty,audioReady,status,presencePayload]);

 const connect=async(nextCode:string,host:boolean)=>{
  const normalized=cleanCode(nextCode);if(normalized.length!==6){setMessage('ENTER A 6-CHARACTER ROOM CODE');return}
  await cleanup();setAudioReady(false);setStatus('connecting');setMessage('CONNECTING TO REALTIME…');setPlayers([]);hostRef.current=host;setIsHost(host);setRoomCode(normalized);setCode(normalized);
  try{
   const client=await getClient();clientRef.current=client;
   const channel=client.channel('rhythtap:'+normalized,{config:{broadcast:{self:true,ack:true},presence:{key:idRef.current}}});channelRef.current=channel;
   channel.on('presence',{event:'sync'},()=>{
    const list=flattenPresence(channel.presenceState()).sort((a,b)=>Number(Boolean(b.isHost))-Number(Boolean(a.isHost))||(a.joinedAt??0)-(b.joinedAt??0));
    setPlayers(list);
    const hostPlayer=list.find(player=>player.isHost);
    if(!host&&hostPlayer){setSongId(hostPlayer.songId);setDifficulty(hostPlayer.difficulty)}
    if(list.length>2&&!list.slice(0,2).some(player=>player.playerId===idRef.current)){setStatus('full');setMessage('ROOM IS FULL')}
   });
   channel.on('broadcast',{event:'settings'},({payload}:{payload:any})=>{if(!host&&payload?.songId){setSongId(payload.songId);setDifficulty(payload.difficulty)}});
   channel.on('broadcast',{event:'start'},({payload}:{payload:any})=>{
    if(!payload?.songId||!payload?.startAt)return;
    launchRef.current({roomCode:normalized,playerId:idRef.current,displayName:(name.trim()||'PLAYER').slice(0,18),isHost:host,songId:payload.songId,difficulty:payload.difficulty,startAt:payload.startAt});
   });
   channel.subscribe(async(state:string)=>{
    if(state==='SUBSCRIBED'){setStatus('connected');setMessage(host?'ROOM READY — SHARE THE CODE':'JOINED — WAITING FOR HOST');await channel.track(presencePayload())}
    else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'){setStatus('error');setMessage('REALTIME CONNECTION FAILED')}
   });
  }catch(error){setStatus('error');setMessage(error instanceof Error?error.message:'Unable to connect to multiplayer')}
 };

 const broadcastSettings=(nextSong=songId,nextDifficulty=difficulty)=>{const channel=channelRef.current;if(!channel||!isHost)return;void channel.send({type:'broadcast',event:'settings',payload:{songId:nextSong,difficulty:nextDifficulty}})};
 const chooseSong=(next:string)=>{if(!isHost)return;setAudioReady(false);setSongId(next);broadcastSettings(next,difficulty)};
 const chooseDifficulty=(next:MultiplayerDifficulty)=>{if(!isHost)return;setDifficulty(next);broadcastSettings(songId,next)};
 const startMatch=()=>{const channel=channelRef.current;if(!channel||!isHost||!bothReady||!selectedSong)return;const startAt=Date.now()+4000;void channel.send({type:'broadcast',event:'start',payload:{songId:selectedSong.id,difficulty,startAt}})};
 const copyCode=()=>{void navigator.clipboard?.writeText(roomCode)};

 if(roomCode)return <section className="multiplayer screen">
  <header><button className="icon" onClick={()=>{void cleanup();setRoomCode('');setStatus('idle')}} aria-label="Leave room"><ArrowLeft/></button><div><small>ONLINE BATTLE</small><h2>ROOM {roomCode}</h2></div><span className={'mp-status '+status}>{status==='connected'?<Wifi/>:<WifiOff/>}</span></header>
  <div className="mp-room-code"><span>ROOM CODE</span><strong>{roomCode}</strong><button className="icon" onClick={copyCode} aria-label="Copy room code"><Copy/></button></div>
  <div className="mp-player-grid">{[0,1].map(index=>{const player=players[index];return <div key={index} className={'mp-player '+(player?'online':'waiting')}><div className="mp-avatar"><Users/></div><small>{index===0?'HOST':'CHALLENGER'}</small><strong>{player?.name??'WAITING…'}</strong><span>{player?(player.ready?'TRACK READY':'DOWNLOADING…'):'SHARE THE CODE'}</span></div>})}</div>
  <div className="mp-panel"><div className="section-label"><span>TRACK</span><small>{isHost?'HOST SELECTS':'SYNCED TO HOST'}</small></div><div className="mp-song-list">{songs.map(song=>{const locked=profileLevel<song.unlockLevel;return <button key={song.id} disabled={!isHost||locked} className={songId===song.id?'active':''} onClick={()=>chooseSong(song.id)}><span><small>{song.artist}</small><strong>{song.title}</strong></span><em>{locked?'LOCKED':song.charts[difficulty].length+' NOTES'}</em></button>})}</div></div>
  <div className="difficulty mp-difficulty" aria-label="Multiplayer difficulty">{(['EASY','NORMAL','HARD'] as MultiplayerDifficulty[]).map(item=><button key={item} disabled={!isHost} className={difficulty===item?'active':''} onClick={()=>chooseDifficulty(item)}><span>{item}</span><small>{selectedSong?.charts[item]?.length??0} NOTES</small></button>)}</div>
  <div className="mp-room-footer"><div><Radio/><span><strong>{!audioReady?'PREPARING TRACK…':!bothReady&&players.length===2?'WAITING FOR OPPONENT AUDIO':message}</strong><small>{opponentCount?`${opponentCount} opponent connected`:'Waiting for a second player'}</small></span></div>{isHost?<button className="primary" disabled={status!=='connected'||!bothReady} onClick={startMatch}><Play fill="currentColor"/> START BATTLE</button>:<div className="mp-wait"><LoaderCircle/> HOST STARTS THE MATCH</div>}</div>
 </section>;

 return <section className="multiplayer screen">
  <header><button className="icon" onClick={onBack} aria-label="Back"><ArrowLeft/></button><div><small>ONLINE</small><h2>SCORE BATTLE</h2></div><Zap/></header>
  <div className="mp-hero"><div className="mp-hero-icon"><Users/></div><small>2 PLAYER REALTIME</small><h1>PLAY THE SAME TRACK.<br/><i>OUTSCORE YOUR RIVAL.</i></h1><p>Private room codes, synchronized starts, live score and combo updates.</p></div>
  <label className="mp-name"><span>DISPLAY NAME</span><input value={name} maxLength={18} onChange={event=>setName(event.target.value)} placeholder="PLAYER"/></label>
  <div className="mp-actions"><button className="primary" onClick={()=>{const next=makeCode();setCode(next);void connect(next,true)}}><Users/> CREATE PRIVATE ROOM</button><div className="mp-divider"><span>OR JOIN</span></div><div className="mp-join"><input value={code} maxLength={6} onChange={event=>setCode(cleanCode(event.target.value))} placeholder="ABC123" inputMode="text"/><button className="secondary" disabled={code.length!==6||status==='connecting'} onClick={()=>{void connect(code,false)}}>{status==='connecting'?<LoaderCircle/>:<RefreshCw/>} JOIN</button></div></div>
  {message&&<div className="mp-message">{message}</div>}
  <div className="mp-footnote"><Wifi/><span><strong>SUPABASE REALTIME</strong><small>Rooms are temporary and disappear when both players leave.</small></span></div>
 </section>;
}

export function useMultiplayerSession(launch:MultiplayerLaunch|null,onRematchStart?:(startAt:number)=>void):MultiplayerSession{
 const [connected,setConnected]=useState(false),[opponent,setOpponent]=useState<MultiplayerProgress|null>(null),[localRematch,setLocalRematch]=useState(false),[opponentRematch,setOpponentRematch]=useState(false);
 const channelRef=useRef<RealtimeChannel|null>(null),clientRef=useRef<SupabaseClient|null>(null),lastSent=useRef(0),launchRef=useRef(launch),rematchStarted=useRef(false),rematchCallback=useRef(onRematchStart);launchRef.current=launch;rematchCallback.current=onRematchStart;
 useEffect(()=>{setLocalRematch(false);setOpponentRematch(false);rematchStarted.current=false},[launch?.startAt]);
 useEffect(()=>{let cancelled=false;setOpponent(null);setConnected(false);const connect=async()=>{if(!launch)return;try{const client=await getClient();if(cancelled)return;clientRef.current=client;const channel=client.channel('rhythtap:'+launch.roomCode,{config:{broadcast:{self:false,ack:false},presence:{key:launch.playerId}}});channelRef.current=channel;channel.on('broadcast',{event:'progress'},({payload}:{payload:MultiplayerProgress})=>{if(payload?.playerId!==launch.playerId)setOpponent(current=>({...current,...payload}))});channel.on('broadcast',{event:'final'},({payload}:{payload:MultiplayerProgress})=>{if(payload?.playerId!==launch.playerId)setOpponent({...payload,finished:true})});channel.on('broadcast',{event:'rematch-ready'},({payload}:{payload:any})=>{if(payload?.playerId!==launch.playerId)setOpponentRematch(true)});channel.on('broadcast',{event:'rematch-start'},({payload}:{payload:any})=>{if(payload?.startAt)rematchCallback.current?.(payload.startAt)});channel.subscribe(async(state:string)=>{if(state==='SUBSCRIBED'){setConnected(true);await channel.track({playerId:launch.playerId,name:launch.displayName,playing:true})}if(state==='CLOSED'||state==='CHANNEL_ERROR'||state==='TIMED_OUT')setConnected(false)})}catch{setConnected(false)}};void connect();return()=>{cancelled=true;const channel=channelRef.current;channelRef.current=null;if(channel){void channel.untrack();void clientRef.current?.removeChannel(channel)}}},[launch?.roomCode,launch?.playerId]);
 const send=useCallback((event:'progress'|'final',progress:Omit<MultiplayerProgress,'playerId'|'name'|'finished'>)=>{const current=launchRef.current,channel=channelRef.current;if(!current||!channel)return;void channel.send({type:'broadcast',event,payload:{...progress,playerId:current.playerId,name:current.displayName,finished:event==='final'}})},[]);
 const publishProgress=useCallback((progress:Omit<MultiplayerProgress,'playerId'|'name'>)=>{const now=performance.now();if(!progress.finished&&now-lastSent.current<120)return;lastSent.current=now;send('progress',progress)},[send]);
 const publishFinal=useCallback((progress:Omit<MultiplayerProgress,'playerId'|'name'|'finished'>)=>send('final',progress),[send]);
 const requestRematch=useCallback(()=>{const current=launchRef.current,channel=channelRef.current;if(!current||!channel)return;setLocalRematch(true);void channel.send({type:'broadcast',event:'rematch-ready',payload:{playerId:current.playerId}})},[]);
 useEffect(()=>{const current=launchRef.current,channel=channelRef.current;if(!current?.isHost||!channel||!localRematch||!opponentRematch||rematchStarted.current)return;rematchStarted.current=true;const startAt=Date.now()+4000;void channel.send({type:'broadcast',event:'rematch-start',payload:{startAt}});rematchCallback.current?.(startAt)},[localRematch,opponentRematch]);
 return useMemo(()=>({enabled:Boolean(launch),launch,connected,opponent,localRematch,opponentRematch,publishProgress,publishFinal,requestRematch}),[launch,connected,opponent,localRematch,opponentRematch,publishProgress,publishFinal,requestRematch]);
}

export function MultiplayerHud({session}:{session:MultiplayerSession}){if(!session.enabled)return null;return <div className="mp-game-hud"><div><span className={session.connected?'online':'offline'}>{session.connected?<Wifi/>:<WifiOff/>}</span><small>ROOM {session.launch?.roomCode}</small></div><div><small>OPPONENT</small><strong>{session.opponent?.score?.toLocaleString()??'0'}</strong><span>{session.opponent?`${session.opponent.combo} COMBO · ${session.opponent.accuracy.toFixed(1)}%`:'CONNECTING…'}</span></div></div>}

export function MultiplayerResultOverlay({session,localScore}:{session:MultiplayerSession,localScore:number}){if(!session.enabled)return null;const opponent=session.opponent,won=opponent?.finished?localScore>opponent.score:null;return <div className="mp-result-overlay"><div><Radio/><span><small>ONLINE BATTLE · ROOM {session.launch?.roomCode}</small><strong>{opponent?.finished?(won?'VICTORY':localScore===opponent.score?'DRAW':'DEFEAT'):'WAITING FOR OPPONENT…'}</strong><em>{opponent?`${opponent.name} · ${opponent.score.toLocaleString()} PTS`:'Opponent result has not arrived yet'}{session.localRematch?' · REMATCH READY':''}{session.opponentRematch?' · OPPONENT READY':''}</em></span></div></div>}
