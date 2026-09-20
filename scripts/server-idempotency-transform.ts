import type {Plugin} from 'vite';

const replaceRequired=(source:string,label:string,before:string,after:string)=>{if(!source.includes(before))throw new Error(`[server-idempotency] Unable to patch ${label}; transformed layout changed.`);return source.replace(before,after)};

const patchMain=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'game result run id',"events?:GameplayJudgementEvent[],progressPending?:boolean,progressError?:string};","events?:GameplayJudgementEvent[],runId?:string,progressPending?:boolean,progressError?:string};");
 code=replaceRequired(code,'run id helper',"const SONG_FAIL_WARNING=25;","const SONG_FAIL_WARNING=25;\nconst createRunId=()=>{if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;return Array.from(bytes,(value,index)=>([4,6,8,10].includes(index)?'-':'')+value.toString(16).padStart(2,'0')).join('')};");
 code=replaceRequired(code,'authenticated award run id',"playerAccount.recordGame({songId:song.id,difficulty,events:r.events||[]})","playerAccount.recordGame({songId:song.id,difficulty,events:r.events||[],runId:r.runId||''})");
 code=replaceRequired(code,'game run id ref',"energyRef=useRef(100),soloEvents=useRef<GameplayJudgementEvent[]>([]);","energyRef=useRef(100),soloEvents=useRef<GameplayJudgementEvent[]>([]),runIdRef=useRef(createRunId());");
 code=replaceRequired(code,'new run id per attempt',"const begin=async()=>{judged.current.clear();soloEvents.current=[];","const begin=async()=>{judged.current.clear();soloEvents.current=[];runIdRef.current=createRunId();");
 code=replaceRequired(code,'completion carries run id',"counts:c,events:soloEvents.current.slice()};","counts:c,events:soloEvents.current.slice(),runId:runIdRef.current};");
 return code;
};

const patchAccount=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'controller run id',"recordGame:(input:{songId:string;difficulty:string;events:GameplayJudgementEvent[]})=>Promise<ProgressAward|null>;","recordGame:(input:{songId:string;difficulty:string;events:GameplayJudgementEvent[];runId:string})=>Promise<ProgressAward|null>;");
 code=replaceRequired(code,'record game run id input',"const recordGame=useCallback(async(input:{songId:string;difficulty:string;events:GameplayJudgementEvent[]})=>","const recordGame=useCallback(async(input:{songId:string;difficulty:string;events:GameplayJudgementEvent[];runId:string})=>");
 code=replaceRequired(code,'record game run id body',"body:JSON.stringify({songId:input.songId,difficulty:input.difficulty,chartVersion:5,events:input.events})","body:JSON.stringify({songId:input.songId,difficulty:input.difficulty,chartVersion:5,events:input.events,runId:input.runId})");
 return code;
};

export function serverIdempotencyTransform():Plugin{return{name:'rhythtap-server-idempotency-transform',enforce:'pre',transform(source,id){const normalized=id.replaceAll('\\','/');if(normalized.endsWith('/src/main.tsx'))return{code:patchMain(source),map:null};if(normalized.endsWith('/src/player-account.tsx'))return{code:patchAccount(source),map:null};return null}}}
