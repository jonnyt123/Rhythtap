import {SUPABASE_ANON_KEY,SUPABASE_ESM,SUPABASE_URL} from './multiplayer-common';

export type EngagementEventName=
 |'game_open'
 |'home_primary_action'
 |'mode_selected'
 |'song_selected'
 |'difficulty_selected'
 |'song_started'
 |'song_completed'
 |'song_retry'
 |'results_continue';

export type EngagementEvent={
 name:EngagementEventName;
 userId?:string|null;
 songId?:string;
 difficulty?:string;
 value?:number;
 metadata?:Record<string,unknown>;
};

type SupabaseClient=any;
let clientPromise:Promise<SupabaseClient>|null=null;
const getClient=()=>{if(clientPromise)return clientPromise;clientPromise=(async()=>{const importer=new Function('url','return import(url)') as (url:string)=>Promise<any>;const module=await importer(SUPABASE_ESM);return module.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'rhythtap-account-auth'}})})();return clientPromise};

const SESSION_KEY='rhythtap-engagement-session-v1';
const sessionId=()=>{let value=sessionStorage.getItem(SESSION_KEY);if(value)return value;value=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;sessionStorage.setItem(SESSION_KEY,value);return value};

export async function trackEngagement(event:EngagementEvent){
 try{
  const client=await getClient();
  const payload={
   user_id:event.userId||null,
   session_id:sessionId(),
   event_name:event.name,
   song_id:event.songId||null,
   difficulty:event.difficulty||null,
   value:event.value??null,
   metadata:event.metadata||{},
   client_ts:new Date().toISOString(),
  };
  const{error}=await client.from('player_engagement_events').insert(payload);
  if(error)console.warn('[engagement] event skipped',error.message);
 }catch(error){console.warn('[engagement] event skipped',error instanceof Error?error.message:error)}
}
