import type {Plugin} from 'vite';

const replaceRequired=(source:string,label:string,before:string,after:string)=>{
 if(!source.includes(before))throw new Error(`[multiplayer-hardening] Unable to patch ${label}; transformed layout changed.`);
 return source.replace(before,after);
};

const patchMain=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'disable solo failure in battle',
  " const adjustEnergy=(delta:number)=>{const applied=delta<0&&inFailGrace()?0:delta,next=Math.max(0,Math.min(100,energyRef.current+applied));energyRef.current=next;if(next<=0)failedRef.current=true;setEnergy(next);return next};",
  " const adjustEnergy=(delta:number)=>{if(multiplayerSession.enabled){energyRef.current=100;if(energy!==100)setEnergy(100);return 100}const applied=delta<0&&inFailGrace()?0:delta,next=Math.max(0,Math.min(100,energyRef.current+applied));energyRef.current=next;if(next<=0)failedRef.current=true;setEnergy(next);return next};");
 code=replaceRequired(code,'hide solo performance meter in battle',
  "  <GameplayMeters energy={energy} pulse={pulse}/>\n  <MultiplayerHud session={multiplayerSession} localScore={score}/>",
  "  {!multiplayerSession.enabled&&<GameplayMeters energy={energy} pulse={pulse}/>}\n  <MultiplayerHud session={multiplayerSession} localScore={score}/>");
 code=replaceRequired(code,'background recovery cannot fail battle',
  "if(skipped){setCounts(c=>({...c,MISS:c.MISS+skipped}));setCombo(0);setEnergy(e=>Math.max(0,e-Math.min(40,skipped*8)))}nowRef.current=target;",
  "if(skipped){setCounts(c=>({...c,MISS:c.MISS+skipped}));setCombo(0)}nowRef.current=target;");
 return code;
};

const patchLobby=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'start lock ref',
  "matchTokensRef=useRef(new Map<string,string>()),quickChannelRef=useRef<RealtimeChannel|null>(null),quickMatchedRef=useRef(false);",
  "matchTokensRef=useRef(new Map<string,string>()),quickChannelRef=useRef<RealtimeChannel|null>(null),quickMatchedRef=useRef(false),startingMatchRef=useRef(false);");
 code=replaceRequired(code,'deduplicate presence',
  "const list=flattenPresence(channel.presenceState()).sort((a,b)=>Number(Boolean(b.isHost))-Number(Boolean(a.isHost))||(a.joinedAt??0)-(b.joinedAt??0));setPlayers(list);",
  "const presence=flattenPresence(channel.presenceState()),unique=new Map<string,any>();for(const player of presence){const key=String(player?.playerId||'');if(!key)continue;const previous=unique.get(key);if(!previous||Number(player?.joinedAt||0)>=Number(previous?.joinedAt||0))unique.set(key,player)}const list=Array.from(unique.values()).sort((a,b)=>Number(Boolean(b.isHost))-Number(Boolean(a.isHost))||(a.joinedAt??0)-(b.joinedAt??0));setPlayers(list);");
 code=replaceRequired(code,'single-flight battle start',
  " const startMatch=async()=>{const channel=channelRef.current;if(!channel||!isHost||!bothReady||!selectedSong)return;const matchId=makeUuid();setMessage('REGISTERING VERIFIED MATCH…');try{const registration=await registerMatchParticipant({matchId,roomCode,playerId:idRef.current,displayName:(name.trim()||'PLAYER').slice(0,18),isHost:true,songId:selectedSong.id,difficulty});matchTokensRef.current.set(matchId,registration.submissionToken);setMessage('MATCH VERIFIED · STARTING…');void channel.send({type:'broadcast',event:'start',payload:{songId:selectedSong.id,difficulty,hostStartAt:registration.hostStartAt,matchId}})}catch(error){setMessage(error instanceof Error?error.message:'Unable to create verified match')}};",
  " const startMatch=async()=>{const channel=channelRef.current;if(!channel||!isHost||!bothReady||!selectedSong||startingMatchRef.current)return;startingMatchRef.current=true;const matchId=makeUuid();setMessage('REGISTERING VERIFIED MATCH…');try{const registration=await registerMatchParticipant({matchId,roomCode,playerId:idRef.current,displayName:(name.trim()||'PLAYER').slice(0,18),isHost:true,songId:selectedSong.id,difficulty});matchTokensRef.current.set(matchId,registration.submissionToken);setMessage('MATCH VERIFIED · STARTING…');void channel.send({type:'broadcast',event:'start',payload:{songId:selectedSong.id,difficulty,hostStartAt:registration.hostStartAt,matchId}})}catch(error){setMessage(error instanceof Error?error.message:'Unable to create verified match')}finally{startingMatchRef.current=false}};");
 return code;
};

export function multiplayerHardeningTransform():Plugin{
 return {name:'rhythtap-multiplayer-hardening-transform',enforce:'pre',transform(source,id){
  const normalized=id.replaceAll('\\','/');
  if(normalized.endsWith('/src/main.tsx'))return{code:patchMain(source),map:null};
  if(normalized.endsWith('/src/multiplayer-lobby.tsx'))return{code:patchLobby(source),map:null};
  return null;
 }};
}
