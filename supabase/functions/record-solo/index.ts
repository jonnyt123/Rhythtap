import {createClient} from 'npm:@supabase/supabase-js@2';
import {buildCanonicalChart,validateAgainstChart,type CanonicalChart,type Difficulty} from '../validate-match/validator-v3.ts';

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

const authenticatedUserId=async(req:Request)=>{
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),authorization=req.headers.get('authorization')||'',token=authorization.replace(/^Bearer\s+/i,'').trim();
 if(!url||!anon)throw new Error('Server configuration missing');
 if(!token)throw new Error('Authentication required');
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}}),{data,error}=await client.auth.getUser(token);
 if(error||!data.user?.id)throw new Error('Authentication required');
 return data.user.id;
};

const loadOnsetSource=async()=>{
 if(onsetSourcePromise)return onsetSourcePromise;
 onsetSourcePromise=(async()=>{const response=await fetch(CHART_SOURCE_URL,{headers:{accept:'text/plain'}});if(!response.ok)throw new Error(`Authoritative chart source unavailable (${response.status})`);return response.text()})();
 try{return await onsetSourcePromise}catch(error){onsetSourcePromise=null;throw error}
};
const loadChart=async(songId:string,difficulty:Difficulty):Promise<CanonicalChart>=>buildCanonicalChart(songId,difficulty,AUDIO_SONGS.has(songId)?await loadOnsetSource():undefined);

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const userId=await authenticatedUserId(req),body=await req.json(),songId=String(body?.songId||'').slice(0,80),difficulty=String(body?.difficulty||'') as Difficulty;
  if(!songId||!['EASY','NORMAL','HARD'].includes(difficulty))return json({error:'Invalid solo result metadata'},400);
  const chart=await loadChart(songId,difficulty),result=validateAgainstChart(body?.events,chart),admin=adminClient();
  const {data,error}=await admin.rpc('record_validated_player_game',{p_user_id:userId,p_song_id:songId,p_difficulty:difficulty,p_score:result.score,p_accuracy:result.accuracy,p_max_combo:result.maxCombo,p_perfect_hits:result.perfect});
  if(error)throw error;
  const row=Array.isArray(data)?data[0]:data;
  if(!row)throw new Error('Progress update returned no data');
  return json({
   progress:{xp:Number(row.xp),level:Number(row.level),songsCompleted:Number(row.songs_completed),perfectHits:Number(row.perfect_hits),bestCombo:Number(row.best_combo),xpAwarded:Number(row.xp_awarded),dailyBonus:Number(row.daily_bonus)},
   result:{score:result.score,accuracy:result.accuracy,maxCombo:result.maxCombo,eventCount:result.eventCount,counts:{PERFECT:result.perfect,GREAT:result.great,GOOD:result.good,MISS:result.miss},validationVersion:3,validation:'verified'}
  });
 }catch(error){
  const message=error instanceof Error?error.message:'Solo validation failed',status=/Authentication required/i.test(message)?401:/too soon/i.test(message)?429:/unavailable|configuration/i.test(message)?503:400;
  return json({error:message},status)}
});