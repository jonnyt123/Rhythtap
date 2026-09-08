import {SUPABASE_ANON_KEY,SUPABASE_ESM,SUPABASE_URL} from './multiplayer-common';

export type AccountSupabaseClient=any;

let accountClientPromise:Promise<AccountSupabaseClient>|null=null;

export const getAccountSupabaseClient=()=>{
 if(accountClientPromise)return accountClientPromise;
 accountClientPromise=(async()=>{
  const importer=new Function('url','return import(url)') as (url:string)=>Promise<any>;
  const module=await importer(SUPABASE_ESM);
  return module.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'rhythtap-account-auth'},realtime:{params:{eventsPerSecond:10}}});
 })();
 return accountClientPromise;
};
