import type {Plugin} from 'vite';

const replaceRequired=(source:string,label:string,before:string,after:string)=>{
 if(!source.includes(before))throw new Error(`[multiplayer-loop] Unable to patch ${label}; source layout changed.`);
 return source.replace(before,after);
};

const patchLobby=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'lobby signature',
  "export function MultiplayerLobby({songs,profileLevel,playerId,displayName,initialDifficulty,onBack,onLaunch}:{songs:MultiplayerSong[],profileLevel:number,playerId:string,displayName:string,initialDifficulty:MultiplayerDifficulty,onBack:()=>void,onLaunch:(launch:MultiplayerLaunch)=>void}){",
  "export function MultiplayerLobby({songs,profileLevel,playerId,displayName,initialDifficulty,initialRoomCode='',initialHost=false,onBack,onLaunch}:{songs:MultiplayerSong[],profileLevel:number,playerId:string,displayName:string,initialDifficulty:MultiplayerDifficulty,initialRoomCode?:string,initialHost?:boolean,onBack:()=>void,onLaunch:(launch:MultiplayerLaunch)=>void}){");
 code=replaceRequired(code,'manual ready state',
  "[audioReady,setAudioReady]=useState(false),[status,setStatus]",
  "[audioReady,setAudioReady]=useState(false),[playerReady,setPlayerReady]=useState(false),[queueing,setQueueing]=useState(false),[status,setStatus]");
 code=replaceRequired(code,'queue refs',
  "matchTokensRef=useRef(new Map<string,string>());",
  "matchTokensRef=useRef(new Map<string,string>()),quickChannelRef=useRef<RealtimeChannel|null>(null),quickMatchedRef=useRef(false);");
 code=replaceRequired(code,'ready ref',
  "launchRef.current=onLaunch;readyRef.current=audioReady;selectionRef.current={songId,difficulty};",
  "launchRef.current=onLaunch;readyRef.current=playerReady;selectionRef.current={songId,difficulty};");
 code=replaceRequired(code,'audio reset',
  "const ensureAudio=useCallback(async(song:MultiplayerSong|undefined)=>{setAudioReady(false);sendReady(false);",
  "const ensureAudio=useCallback(async(song:MultiplayerSong|undefined)=>{setAudioReady(false);setPlayerReady(false);sendReady(false);");
 code=replaceRequired(code,'audio ready synthetic',
  "if(!song.audioFile){setAudioReady(true);sendReady(true);return}",
  "if(!song.audioFile){setAudioReady(true);return}");
 code=replaceRequired(code,'audio ready fetched',
  "setAudioReady(true);sendReady(true)}catch",
  "setAudioReady(true)}catch");
 code=replaceRequired(code,'connect ready reset',
  "await cleanup();setAudioReady(false);setReadyMap({});setStatus('connecting');",
  "await cleanup();setAudioReady(false);setPlayerReady(false);setReadyMap({});setStatus('connecting');");
 code=replaceRequired(code,'song ready reset',
  "const chooseSong=(next:string)=>{if(!isHost)return;setAudioReady(false);setReadyMap({});",
  "const chooseSong=(next:string)=>{if(!isHost)return;setAudioReady(false);setPlayerReady(false);sendReady(false);setReadyMap({});");
 code=replaceRequired(code,'difficulty ready reset',
  "const chooseDifficulty=(next:MultiplayerDifficulty)=>{if(!isHost)return;setAudioReady(false);setReadyMap({});",
  "const chooseDifficulty=(next:MultiplayerDifficulty)=>{if(!isHost)return;setAudioReady(false);setPlayerReady(false);sendReady(false);setReadyMap({});");
 const startMarker=" const copyCode=()=>{void navigator.clipboard?.writeText(roomCode)};";
 const loopLogic=` const toggleReady=()=>{if(!audioReady||players.length!==2)return;const next=!playerReady;setPlayerReady(next);setReadyMap(current=>({...current,[idRef.current]:next}));sendReady(next)};
 const cleanupQuick=async()=>{const channel=quickChannelRef.current;quickChannelRef.current=null;if(channel){try{await channel.untrack()}catch{}try{await clientRef.current?.removeChannel(channel)}catch{}}setQueueing(false)};
 const finishQuick=async(nextCode:string,host:boolean)=>{if(quickMatchedRef.current)return;quickMatchedRef.current=true;await cleanupQuick();await connect(nextCode,host)};
 const startQuickMatch=async()=>{if(queueing)return;quickMatchedRef.current=false;setQueueing(true);setMessage('LOOKING FOR A RIVAL…');try{const client=await getClient();clientRef.current=client;const channel=client.channel('rhythtap:quick-match-v1',{config:{broadcast:{self:false,ack:true},presence:{key:idRef.current}}});quickChannelRef.current=channel;
   channel.on('broadcast',{event:'quick-offer'},({payload}:{payload:any})=>{if(payload?.to!==idRef.current||!payload?.code||quickMatchedRef.current)return;void finishQuick(cleanCode(payload.code),false)});
   channel.on('presence',{event:'sync'},()=>{if(quickMatchedRef.current)return;const list=flattenPresence(channel.presenceState()).filter((p:any)=>p?.playerId).sort((a:any,b:any)=>(Number(a.joinedAt)||0)-(Number(b.joinedAt)||0)||String(a.playerId).localeCompare(String(b.playerId)));const mine=list.findIndex((p:any)=>p.playerId===idRef.current);if(mine<0)return;const partnerIndex=mine%2===0?mine+1:mine-1,partner=list[partnerIndex];if(!partner)return;if(mine%2===0){const nextCode=makeCode();quickMatchedRef.current=true;void(async()=>{await channel.send({type:'broadcast',event:'quick-offer',payload:{from:idRef.current,to:partner.playerId,code:nextCode}});await cleanupQuick();quickMatchedRef.current=false;await finishQuick(nextCode,true)})()}});
   channel.subscribe(async(state:string)=>{if(state==='SUBSCRIBED'){await channel.track({playerId:idRef.current,name:(name.trim()||'PLAYER').slice(0,18),joinedAt:Date.now()})}else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'){await cleanupQuick();setMessage('QUICK MATCH FAILED — TRY AGAIN')}})}catch{await cleanupQuick();setMessage('QUICK MATCH FAILED — TRY AGAIN')}};
 const cancelQuick=()=>{quickMatchedRef.current=true;void cleanupQuick();setMessage('')};
 useEffect(()=>()=>{void cleanupQuick()},[]);
 useEffect(()=>{if(initialRoomCode&&!roomCode&&status==='idle')void connect(initialRoomCode,initialHost)},[]);
`;
 code=replaceRequired(code,'post battle and quick logic',startMarker,loopLogic+startMarker);
 const entryBefore='<div className="mp-actions"><button className="primary mp-create" onClick={()=>{const next=makeCode();setCode(next);void connect(next,true)}}><Trophy/> CREATE BATTLE</button><div className="mp-divider"><span>HAVE A CODE?</span></div>';
 const entryAfter='<div className="mp-actions"><button className="primary mp-quick" onClick={()=>void startQuickMatch()} disabled={queueing}>{queueing?<><LoaderCircle/> FINDING RIVAL…</>:<><Zap/> QUICK MATCH</>}</button>{queueing&&<button className="secondary mp-cancel-quick" onClick={cancelQuick}>CANCEL SEARCH</button>}<div className="mp-divider"><span>OR PLAY PRIVATE</span></div><button className="primary mp-create" onClick={()=>{const next=makeCode();setCode(next);void connect(next,true)}}><Trophy/> CREATE BATTLE</button><div className="mp-divider"><span>HAVE A CODE?</span></div>';
 code=replaceRequired(code,'quick match entry',entryBefore,entryAfter);
 const controlsBefore="{isHost?<button className=\"primary mp-start-button\" disabled={status!=='connected'||!bothReady} onClick={()=>{void startMatch()}}>{status!=='connected'?<><LoaderCircle/> CONNECTING…</>:players.length<2?<><Users/> WAITING FOR RIVAL</>:!bothReady?<><LoaderCircle/> GETTING READY…</>:<><Play fill=\"currentColor\"/> START BATTLE</>}</button>:<div className=\"mp-wait\">{bothReady?<><Play/> READY — WAITING FOR HOST</>:<><LoaderCircle/> GETTING READY…</>}</div>}";
 const controlsAfter="<div className=\"mp-ready-actions\"><button className={'secondary mp-ready-button '+(playerReady?'active':'')} disabled={!audioReady||players.length!==2} onClick={toggleReady}>{!audioReady?<><LoaderCircle/> PREPARING…</>:playerReady?<><Check/> READY</>:<><Check/> READY UP</>}</button>{isHost?<button className=\"primary mp-start-button\" disabled={status!=='connected'||!bothReady} onClick={()=>{void startMatch()}}>{status!=='connected'?<><LoaderCircle/> CONNECTING…</>:players.length<2?<><Users/> WAITING FOR RIVAL</>:!bothReady?<><LoaderCircle/> BOTH PLAYERS READY?</>:<><Play fill=\"currentColor\"/> START BATTLE</>}</button>:<div className=\"mp-wait\">{playerReady?<><Play/> READY — WAITING FOR HOST</>:<><Check/> READY UP WHEN SET</>}</div>}</div>";
 code=replaceRequired(code,'manual ready controls',controlsBefore,controlsAfter);
 return code;
};

const patchMain=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'resume state',
  "const [multiplayerLaunch,setMultiplayerLaunch]=useState<MultiplayerLaunch|null>(null);",
  "const [multiplayerLaunch,setMultiplayerLaunch]=useState<MultiplayerLaunch|null>(null);\n const [multiplayerResume,setMultiplayerResume]=useState<{roomCode:string,isHost:boolean}|null>(null);");
 code=replaceRequired(code,'resume lobby props',
  "displayName={playerAccount.profile?.displayName||playerAccount.profile?.username||'PLAYER'} initialDifficulty={difficulty}",
  "displayName={playerAccount.profile?.displayName||playerAccount.profile?.username||'PLAYER'} initialDifficulty={difficulty} initialRoomCode={multiplayerResume?.roomCode} initialHost={multiplayerResume?.isHost}");
 code=replaceRequired(code,'clear resume on launch',
  "onLaunch={launch=>{const selected=library.find(item=>item.id===launch.songId);if(!selected)return;setSong(selected);setDifficulty(launch.difficulty);setMultiplayerLaunch(launch);setScreen('game')}}",
  "onLaunch={launch=>{const selected=library.find(item=>item.id===launch.songId);if(!selected)return;setMultiplayerResume(null);setSong(selected);setDifficulty(launch.difficulty);setMultiplayerLaunch(launch);setScreen('game')}}");
 code=replaceRequired(code,'battle results props',
  "retry={()=>multiplayerLaunch?multiplayerSession.requestRematch():setScreen('game')} done={()=>{if(multiplayerLaunch){setMultiplayerLaunch(null);setScreen('home')}else setScreen('select')}}",
  "retry={()=>multiplayerLaunch?multiplayerSession.requestRematch():setScreen('game')} changeSong={()=>{if(multiplayerLaunch){setMultiplayerResume({roomCode:multiplayerLaunch.roomCode,isHost:multiplayerLaunch.isHost});setMultiplayerLaunch(null);setScreen('multiplayer')}}} battle={Boolean(multiplayerLaunch)} done={()=>{if(multiplayerLaunch){setMultiplayerResume(null);setMultiplayerLaunch(null);setScreen('home')}else setScreen('select')}}");
 code=replaceRequired(code,'results signature',
  "function Results({song,difficulty,result,profile,equipTheme,retry,done}:{song:Song,difficulty:Difficulty,result:GameResult,profile:Profile,equipTheme:(theme:NoteTheme)=>void,retry:()=>void,done:()=>void}){",
  "function Results({song,difficulty,result,profile,equipTheme,retry,changeSong,battle=false,done}:{song:Song,difficulty:Difficulty,result:GameResult,profile:Profile,equipTheme:(theme:NoteTheme)=>void,retry:()=>void,changeSong?:()=>void,battle?:boolean,done:()=>void}){");
 code=replaceRequired(code,'results actions',
  '<div className="result-actions"><button className="primary" onClick={retry}><RotateCcw/> RETRY</button><button className="secondary" onClick={done}>TRACK SELECT</button></div>',
  '<div className="result-actions">{battle?<><button className="primary" onClick={retry}><RotateCcw/> REMATCH</button><button className="secondary" onClick={()=>changeSong?.()}><Music2/> CHANGE SONG</button><button className="secondary battle-leave" onClick={done}><ArrowLeft/> LEAVE BATTLE</button></>:<><button className="primary" onClick={retry}><RotateCcw/> RETRY</button><button className="secondary" onClick={done}>TRACK SELECT</button></>}</div>');
 return code;
};

const css=`
/* Multiplayer session loop: manual ready, post-battle loop, quick matchmaking */
.battle-entry .mp-quick{background:linear-gradient(100deg,#29d7ff,#7554ff 54%,#ff3dad);box-shadow:0 10px 30px rgba(41,215,255,.18)}
.battle-entry .mp-quick svg.lucide-loader-circle{animation:mpSpin 1s linear infinite}.mp-cancel-quick{width:100%;min-height:46px}
.mp-ready-actions{display:flex;align-items:center;gap:10px;justify-content:flex-end}.mp-ready-button{min-height:50px;min-width:126px}.mp-ready-button.active{border-color:rgba(105,255,155,.55);background:rgba(105,255,155,.12);color:#8dffae}.mp-ready-button svg.lucide-loader-circle{animation:mpSpin 1s linear infinite}
.results .battle-leave{opacity:.82}
@media(max-width:540px){.mp-ready-actions{width:100%;display:grid;grid-template-columns:1fr}.mp-ready-button{width:100%;min-height:52px}.battle-room .mp-room-footer{grid-template-columns:1fr}.battle-room .mp-room-footer>div:first-child{display:none}.results .result-actions{display:grid;grid-template-columns:1fr}.results .result-actions button{width:100%}}
`;

export function multiplayerSessionLoopTransform():Plugin{
 return {name:'rhythtap-multiplayer-session-loop-transform',enforce:'pre',transform(source,id){
  const normalized=id.replaceAll('\\','/');
  if(normalized.endsWith('/src/multiplayer-lobby.tsx'))return{code:patchLobby(source),map:null};
  if(normalized.endsWith('/src/main.tsx'))return{code:patchMain(source),map:null};
  if(normalized.endsWith('/src/multiplayer.css'))return{code:source+css,map:null};
  return null;
 }};
}
