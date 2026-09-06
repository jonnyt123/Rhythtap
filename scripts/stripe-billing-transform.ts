import type {Plugin} from 'vite';

const required=(source:string,label:string,before:string,after:string)=>{
 if(!source.includes(before))throw new Error(`[stripe-billing] Unable to patch ${label}; transformed layout changed.`);
 return source.replace(before,after);
};

export function stripeBillingTransform():Plugin{
 return{name:'rhythtap-stripe-billing-transform',enforce:'pre',transform(source,id){
  const path=id.replaceAll('\\','/');
  if(!path.endsWith('/src/player-account.tsx'))return null;
  let code=source;
  code=required(code,'billing component import',
   "import {SUPABASE_ANON_KEY,SUPABASE_ESM,SUPABASE_URL} from './multiplayer-common';",
   "import {SUPABASE_ANON_KEY,SUPABASE_ESM,SUPABASE_URL} from './multiplayer-common';\nimport {BillingCard} from './stripe-billing';");
  code=required(code,'profile billing card',
   '<div className="players-panel">',
   '<BillingCard userId={account.userId}/><div className="players-panel">');
  return{code,map:null};
 }};
}
