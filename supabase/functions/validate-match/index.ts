import {createClient} from 'npm:@supabase/supabase-js@2';
import {buildCanonicalChart,validateAgainstChart,type CanonicalChart,type Difficulty} from './validator.ts';

const CHART_SOURCE_COMMIT=Deno.env.get('RHYTHTAP_CHART_COMMIT')||'50c9e0b39aa441e5628ef10d471ed460d758dd69';
const CHART_SOURCE_URL=`https://raw.githubusercontent.com/jonnyt123/Rhythtap/${CHART_SOURCE_COMMIT}/src/audioChartData.ts`;
const AUDIO_SONGS=new Set(['sickness','never-left','fly-eagle']);
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization, x-client-info, apikey, content-type','access-control-allow-methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json','cache-control':'no-store'}});
let onsetSourcePromise:Promise<string>|null=null;

const adminClient=()=>{
 const url=Deno.env.get('SUPABASE_URL');let secretKey='';
 try{const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');secretKey=String(keys?.default||'')}catch{}
 secretKey=secretKey||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 if(!url||!secretKey)throw new Error('Server configuration missing');
 return createClient(url,secretKey,{auth:{persistSession:false,autoRefreshToken:false}});
};
const validUuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const bytesToHex=(bytes:Uint8Array)=>Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
const sha256=async(value:string)=>bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
const randomToken=()=>{const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return bytesToHex(bytes)};
const cleanMetadata=(body:any)=>{
 const matchId=String(body?.matchId||''),playerId=String(body?.playerId||''),roomCode=String(body?.roomCode||'').toUpperCase(),displayName=String(body?.displayName||'PLAYER').trim().slice(0,18),songId=String(body?.songId||'').slice(0,80),difficulty=String(body?.difficulty||'') as Difficulty;
 if(!validUuid(matchId)||!validUuid(playerId)||!/^[A-Z0-9]{6}$/.test(roomCode)||!displayName||!songId||!['EASY','NORMAL','HARD'].includes(difficulty))throw new Error('Invalid match metadata');
 return{matchId,playerId,roomCode,displayName,songId,difficulty};
};
const loadOnsetSource=async()=>{
 if(onsetSourcePromise)return onsetSourcePromise;
 onsetSourcePromise=(async()=>{const response=await fetch(CHART_SOURCE_URL,{headers:{accept:'text/plain'}});if(!response.ok)throw new Error(`Authoritative chart source unavailable (${response.status})`);return response.text()})();
 try{return await onsetSourcePromise}catch(error){onsetSourcePromise=null;throw error}
};
const loadChart=async(songId:string,difficulty:Difficulty):Promise<CanonicalChart>=>buildCanonicalChart(songId,difficulty,AUDIO_SONGS.has(songId)?await loadOnsetSource():undefined);

const register=async(body:any)=>{
 const serverReceivedAt=Date.now(),admin=adminClient(),meta=cleanMetadata(body),isHost=Boolean(body?.isHost),chart=await loadChart(meta.songId,meta.difficulty),now=serverReceivedAt;
 let match:any;
 const {data:existing,error:existingError}=await admin.from('multiplayer_matches').select('*').eq('match_id',meta.matchId).maybeSingle();
 if(existingError)throw existingError;
 if(!existing){
  if(!isHost)return json({error:'Match has not been created by the host'},409);
  const serverStartAt=now+7000,expectedEndAt=serverStartAt+chart.endMs;
  const {data:created,error:createError}=await admin.from('multiplayer_matches').insert({match_id:meta.matchId,room_code:meta.roomCode,song_id:meta.songId,difficulty:meta.difficulty,server_start_at:new Date(serverStartAt).toISOString(),expected_end_at:new Date(expectedEndAt).toISOString(),chart_source_commit:CHART_SOURCE_COMMIT,chart_note_count:chart.notes.length}).select('*').single();
  if(createError)throw createError;match=created;
 }else{
  match=existing;
  if(match.room_code!==meta.roomCode||match.song_id!==meta.songId||match.difficulty!==meta.difficulty||match.chart_source_commit!==CHART_SOURCE_COMMIT||Number(match.chart_note_count)!==chart.notes.length)return json({error:'Match metadata conflict'},409);
  if(new Date(match.expected_end_at).getTime()+120000<now)return json({error:'Match has expired'},410);
 }
 const {data:participant,error:participantError}=await admin.from('multiplayer_participants').select('player_id').eq('match_id',meta.matchId).eq('player_id',meta.playerId).maybeSingle();
 if(participantError)throw participantError;
 if(participant)return json({error:'Participant is already registered for this match'},409);
 const {count,error:countError}=await admin.from('multiplayer_participants').select('*',{count:'exact',head:true}).eq('match_id',meta.matchId);if(countError)throw countError;if((count??0)>=2)return json({error:'Match already has two players'},409);
 const token=randomToken(),tokenHash=await sha256(token),{error:participantInsertError}=await admin.from('multiplayer_participants').insert({match_id:meta.matchId,player_id:meta.playerId,display_name:meta.displayName,token_hash:tokenHash});
 if(participantInsertError)throw participantInsertError;
 const serverSentAt=Date.now();return json({submissionToken:token,serverReceivedAt,serverSentAt,serverStartAt:new Date(match.server_start_at).getTime(),expectedEndAt:new Date(match.expected_end_at).getTime(),chartSourceCommit:CHART_SOURCE_COMMIT,chartNoteCount:chart.notes.length});
};

const finalize=async(body:any)=>{
 const admin=adminClient(),meta=cleanMetadata(body),submissionToken=String(body?.submissionToken||'');
 if(!/^[0-9a-f]{64}$/i.test(submissionToken))return json({error:'Missing submission token'},401);
 const {data:match,error:matchError}=await admin.from('multiplayer_matches').select('*').eq('match_id',meta.matchId).maybeSingle();
 if(matchError)throw matchError;if(!match)return json({error:'Unknown match'},404);
 if(match.room_code!==meta.roomCode||match.song_id!==meta.songId||match.difficulty!==meta.difficulty)return json({error:'Match metadata conflict'},409);
 const {data:participant,error:participantError}=await admin.from('multiplayer_participants').select('token_hash,display_name').eq('match_id',meta.matchId).eq('player_id',meta.playerId).maybeSingle();
 if(participantError)throw participantError;if(!participant||participant.token_hash!==await sha256(submissionToken))return json({error:'Invalid submission token'},401);
 const expectedEndAt=new Date(match.expected_end_at).getTime();
 if(Date.now()<expectedEndAt-1800)return json({error:'Match is not finished yet'},425);
 const chart=await loadChart(match.song_id,match.difficulty as Difficulty);
 if(match.chart_source_commit!==CHART_SOURCE_COMMIT||Number(match.chart_note_count)!==chart.notes.length)return json({error:'Authoritative chart version mismatch'},409);
 const result=validateAgainstChart(body?.events,chart),eventDigest=await sha256(JSON.stringify(result.normalizedEvents));
 const {error}=await admin.from('multiplayer_results').upsert({match_id:meta.matchId,room_code:match.room_code,player_id:meta.playerId,display_name:participant.display_name||meta.displayName,song_id:match.song_id,difficulty:match.difficulty,score:result.score,accuracy:result.accuracy,max_combo:result.maxCombo,event_count:result.eventCount,validation_version:2,chart_source_commit:CHART_SOURCE_COMMIT,chart_note_count:result.noteCount,validated_hold_count:result.holdCount,event_digest:eventDigest},{onConflict:'match_id,player_id'});
 if(error)throw error;
 return json({score:result.score,accuracy:result.accuracy,maxCombo:result.maxCombo,eventCount:result.eventCount,noteCount:result.noteCount,holdCount:result.holdCount,counts:{PERFECT:result.perfect,GREAT:result.great,GOOD:result.good,MISS:result.miss},chartSourceCommit:CHART_SOURCE_COMMIT,validationVersion:2,validation:'verified'});
};

const history=async(body:any)=>{
 const admin=adminClient(),playerId=String(body?.playerId||'');if(!validUuid(playerId))return json({history:[]});
 const {data:mine,error}=await admin.from('multiplayer_results').select('*').eq('player_id',playerId).eq('validation_version',2).order('created_at',{ascending:false}).limit(10);if(error)throw error;if(!mine?.length)return json({history:[]});
 const ids=mine.map((row:any)=>row.match_id),{data:all,error:allError}=await admin.from('multiplayer_results').select('*').in('match_id',ids).eq('validation_version',2);if(allError)throw allError;
 const rows=mine.map((row:any)=>{const opponent=all?.find((other:any)=>other.match_id===row.match_id&&other.player_id!==row.player_id),opponentScore=opponent?.score??null,outcome=opponentScore===null?'UNKNOWN':row.score>opponentScore?'WIN':row.score<opponentScore?'LOSS':'DRAW';return{matchId:row.match_id,songId:row.song_id,difficulty:row.difficulty,createdAt:row.created_at,score:row.score,opponentName:opponent?.display_name??'Waiting for opponent',opponentScore,outcome,validationVersion:row.validation_version}});
 return json({history:rows});
};

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{const body=await req.json();if(body?.action==='register')return await register(body);if(body?.action==='finalize')return await finalize(body);if(body?.action==='history')return await history(body);return json({error:'Unknown action'},400)}
 catch(error){const message=error instanceof Error?error.message:'Validation failed',status=/unavailable|configuration/i.test(message)?503:400;return json({error:message},status)}
});
