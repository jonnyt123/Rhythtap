import {SUPABASE_ANON_KEY,SUPABASE_ESM,SUPABASE_URL} from './multiplayer-common';

export type AccountSupabaseClient=any;

const accountAuthStorage={
 getItem:(key:string)=>{try{return window.localStorage.getItem(key)}catch{return null}},
 setItem:(key:string,value:string)=>{try{window.localStorage.setItem(key,value)}catch{}},
 removeItem:(key:string)=>{try{window.localStorage.removeItem(key)}catch{}}
};

let accountClientPromise:Promise<AccountSupabaseClient>|null=null;

export const getAccountSupabaseClient=()=>{
 if(accountClientPromise)return accountClientPromise;
 accountClientPromise=(async()=>{
  const importer=new Function('url','return import(url)') as (url:string)=>Promise<any>;
  const module=await importer(SUPABASE_ESM);
  return module.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'rhythtap-account-auth',storage:accountAuthStorage},realtime:{params:{eventsPerSecond:10}}});
 })();
 return accountClientPromise;
};
