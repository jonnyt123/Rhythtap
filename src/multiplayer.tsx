import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,Copy,LoaderCircle,Play,Radio,RefreshCw,Users,Wifi,WifiOff,Zap} from 'lucide-react';
import './multiplayer.css';
import './multiplayer-authoritative.css';

export type MultiplayerDifficulty='EASY'|'NORMAL'|'HARD';
export type MultiplayerSong={id:string,title:string,artist:string,unlockLevel:number,audioFile?:string,charts:Record<MultiplayerDifficulty,unknown[]>};
export type JudgementKind='PERFECT'|'GREAT'|'GOOD'|'MISS'|'HOLD';
export type JudgementEvent={kind:JudgementKind,atMs:number,noteId:number,lane:number};
export type MultiplayerLaunch={roomCode:string,matchId:string,submissionToken:string,playerId:string,displayName:string,isHost:boolean,songId:string,difficulty:MultiplayerDifficulty,hostStartAt:number,startAt:number,clockOffsetMs:number,rttMs:number};
export type MultiplayerProgress={playerId:string,name:string,score:number,combo:number,accuracy:number,finished?:boolean,validation?:'verified'|'unverified'|'pending'};
export type VerifiedResult={score:number,accuracy:number,maxCombo:number,eventCount:number,validation:'verified'|'unverified'};
export type MatchHistoryEntry={matchId:string,songId:string,difficulty:MultiplayerDifficulty,createdAt:string,score:number,opponentName:string,opponentScore:number|null,outcome:'WIN'|'LOSS'|'DRAW'|'UNKNOWN'};
export type MultiplayerSession={
 enabled:boolean;launch:MultiplayerLaunch|null;connected:boolean;reconnecting:boolean;opponent:MultiplayerProgress|null;opponentBackgrounded:boolean;
 localRematch:boolean;opponentRematch:boolean;latencyMs:number|null;clockOffsetMs:number;verifiedLocal:VerifiedResult|null;
 publishProgress:(progress:Omit<MultiplayerProgress,'playerId'|'name'>)=>void;
 publishFinal:(progress:Omit<MultiplayerProgress,'playerId'|'name'|'finished'>)=>void;
 recordJudgement:(kind:JudgementKind,noteId:number,lane:number,atMs:number)=>void;
 requestRematch:()=>void;reconnect:()=>Promise<void>;targetElapsedMs:()=>number;setBackgrounded:(hidden:boolean)=>void;
};

type RealtimeChannel=any;
type SupabaseClient=any;
type ClockSample={offsetMs:number,rttMs:number};

const SUPABASE_URL=(import.meta as any).env?.VITE_SUPABASE_URL||'https://hcaawhtkldabetxzptmc.supabase.co';
const SUPABASE_ANON_KEY=(import.meta as any).env?.VITE_SUPABASE_ANON_KEY||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjYWF3aHRrbGRhYmV0eHpwdG1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMTY1MjIsImV4cCI6MjEwMjg5MjUyMn0.K6PcANo2gtvosiW0MUFvaK6NSFl0GL6qS-m3WUxX9eA';
const SUPABASE_ESM='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const DISPLAY_NAME_KEY='rhythtap-multiplayer-name';
const PLAYER_ID_KEY='rhythtap-multiplayer-player-id';
const AUDIO_CACHE='rhythtap-audio-v1';
const ROOM_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CLOCK_SAMPLE_COUNT=7;

let clientPromise:Promise<SupabaseClient>|null=null;
const getClient=()=>{
 if(clientPromise)return clientPromise;
 clientPromise=(async()=>{
  const importer=new Function('url','return import(url)') as (url:string)=>Promise<any>;
  const module=await importer(SUPABASE_ESM);
  return module.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},realtime:{params:{eventsPerSecond:15}}});
 })();
 return clientPromise;
};

const makeCode=()=>Array.from({length:6},()=>ROOM_CHARS[Math.floor(Math.random()*ROOM_CHARS.length)]).join('');
const cleanCode=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
const makeUuid=()=>crypto.randomUUID?.()??'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,char=>{const value=Math.random()*16|0,bits=char==='x'?value:(value&3)|8;return bits.toString(16)});
const stablePlayerId=()=>{let id=localStorage.getItem(PLAYER_ID_KEY);if(!id){id=makeUuid();localStorage.setItem(PLAYER_ID_KEY,id)}return id};
const flattenPresence=(state:Record<string,any[]>)=>Object.values(state).flat().filter(Boolean);
const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2};
export const estimateClock=(samples:ClockSample[]):ClockSample=>{if(!samples.length)return{offsetMs:0,rttMs:0};const best=[...samples].filter(s=>Number.isFinite(s.offsetMs)&&Number.isFinite(s.rttMs)&&s.rttMs>=0).sort((a,b)=>a.rttMs-b.rttMs).slice(0,Math.min(3,samples.length));return{offsetMs:median(best.map(s=>s.offsetMs)),rttMs:median(best.map(s=>s.rttMs))}};
const localStartFromHost=(hostStartAt:number,offsetMs:number)=>hostStartAt-offsetMs;
const functionRequest=async(body:unknown)=>{
 const response=await fetch(`${SUPABASE_URL}/functions/v1/validate-match`,{method:'POST',headers:{'content-type':'application/json','apikey':SUPABASE_ANON_KEY,'authorization':`Bearer ${SUPABASE_ANON_KEY}`},body:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(String(data?.error||`Validation service unavailable (${response.status})`));
 return data;
};
const loadHistory=async(playerId:string):Promise<MatchHistoryEntry[]>=>{try{const data=await functionRequest({action:'history',playerId});return Array.isArray(data?.history)?data.history:[]}catch{return[]}};

type MatchRegistration={submissionToken:string,serverStartAt:number,serverReceivedAt:number,serverSentAt:number,hostStartAt:number};
const registerMatchParticipant=async(input:{matchId:string,roomCode:string,playerId:string,displayName:string,isHost:boolean,songId:string,difficulty:MultiplayerDifficulty}):Promise<MatchRegistration>=>{
 const sentAt=Date.now(),data=await functionRequest({action:'register',...input}),receivedAt=Date.now(),serverReceivedAt=Number(data?.serverReceivedAt),serverSentAt=Number(data?.serverSentAt),serverStartAt=Number(data?.serverStartAt),submissionToken=String(data?.submissionToken||'');
 if(!Number.isFinite(serverReceivedAt)||!Number.isFinite(serverSentAt)||!Number.isFinite(serverStartAt)||!/^[0-9a-f]{64}$/i.test(submissionToken))throw new Error('Invalid match registration response');
 const serverOffset=((serverReceivedAt-sentAt)+(serverSentAt-receivedAt))/2,hostStartAt=input.isHost?serverStartAt-serverOffset:0;
 return{submissionToken,serverStartAt,serverReceivedAt,serverSentAt,hostStartAt};
};

function useClockSync(channelRef:React.MutableRefObject<RealtimeChannel|null>,playerId:string,isHost:boolean){
 const [offsetMs,setOffsetMs]=useState(0),[rttMs,setRttMs]=useState<number|null>(isHost?0:null);
 const offsetRef=useRef(0),rttRef=useRef<number|null>(isHost?0:null),samplesRef=useRef<ClockSample[]>([]),pendingRef=useRef(new Map<string,number>());
 useEffect(()=>{offsetRef.current=offsetMs;rttRef.current=rttMs},["launch","connected","reconnecting","opponent","opponentBackgrounded","localRematch","opponentRematch","latencyMs","clockOffsetMs","verifiedLocal","publishProgress","publishFinal","recordJudgement","requestRematch","reconnect","targetElapsedMs","setBackgrounded"]);
}

export function MultiplayerHud({session}:{session:MultiplayerSession}){if(!session.enabled)return null;return <div className="mp-game-hud"><div><span className={session.connected?'online':'offline'}>{session.connected?<Wifi/>:<WifiOff/>}</span><small>ROOM {session.launch?.roomCode} · {session.reconnecting?'RECONNECTING':session.latencyMs===null?'SYNCING':`${Math.round(session.latencyMs)}ms`}</small></div><div><small>{session.opponentBackgrounded?'OPPONENT BACKGROUNDED':'OPPONENT'}</small><strong>{session.opponent?.score?.toLocaleString()??'0'}</strong><span>{session.opponent?`${session.opponent.combo} COMBO · ${session.opponent.accuracy.toFixed(1)}%`:'CONNECTING…'}</span></div></div>}

export function MultiplayerResultOverlay({session,localScore}:{session:MultiplayerSession,localScore:number}){if(!session.enabled)return null;const opponent=session.opponent,localVerified=session.verifiedLocal?.validation==='verified',opponentVerified=opponent?.validation==='verified',official=Boolean(localVerified&&opponent?.finished&&opponentVerified),verifiedScore=localVerified?session.verifiedLocal!.score:localScore,won=official?verifiedScore>opponent!.score:null,verification=localVerified?'SERVER VERIFIED':session.verifiedLocal?'UNVERIFIED · NOT RANKED':'VALIDATING…',headline=official?(won?'VICTORY':verifiedScore===opponent!.score?'DRAW':'DEFEAT'):session.verifiedLocal?.validation==='unverified'?'VALIDATION REQUIRED':opponent?.finished&&!opponentVerified?'WAITING FOR VERIFIED RESULT':'WAITING FOR OPPONENT…';return <div className="mp-result-overlay"><div><Radio/><span><small>ONLINE BATTLE · ROOM {session.launch?.roomCode} · {verification}</small><strong>{headline}</strong><em>{opponent?`${opponent.name} · ${opponent.score.toLocaleString()} PTS${opponentVerified?' · VERIFIED':' · UNVERIFIED'}`:'Opponent result has not arrived yet'}{session.localRematch?' · REMATCH READY':''}{session.opponentRematch?' · OPPONENT READY':''}</em></span></div></div>}
