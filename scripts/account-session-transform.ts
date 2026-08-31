import type {Plugin} from 'vite';

const replaceRequired=(source:string,label:string,before:string,after:string)=>{
 if(!source.includes(before))throw new Error(`[account-session] Unable to patch ${label}; account client layout changed.`);
 return source.replace(before,after);
};

const patchAccount=(source:string)=>{
 let code=source;
 code=replaceRequired(
  code,
  'persistent auth storage adapter',
  "type SupabaseClient=any;\nlet accountClientPromise:Promise<SupabaseClient>|null=null;",
  "type SupabaseClient=any;\nconst accountAuthStorage={\n getItem:(key:string)=>{try{return window.localStorage.getItem(key)}catch{return null}},\n setItem:(key:string,value:string)=>{try{window.localStorage.setItem(key,value)}catch{}},\n removeItem:(key:string)=>{try{window.localStorage.removeItem(key)}catch{}}\n};\nlet accountClientPromise:Promise<SupabaseClient>|null=null;"
 );
 code=replaceRequired(
  code,
  'persistent Supabase session options',
  "auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'rhythtap-account-auth'}",
  "auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'rhythtap-account-auth',storage:accountAuthStorage}"
 );
 return code;
};

export function accountSessionTransform():Plugin{
 return {name:'rhythtap-account-session-transform',enforce:'pre',transform(source,id){
  if(!id.replaceAll('\\\\','/').endsWith('/src/player-account.tsx'))return null;
  return {code:patchAccount(source),map:null};
 }};
}
