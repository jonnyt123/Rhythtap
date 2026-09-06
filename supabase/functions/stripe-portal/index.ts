import Stripe from 'npm:stripe@22.4.0';
import {createClient} from 'npm:@supabase/supabase-js@2';

const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization, x-client-info, apikey, content-type','access-control-allow-methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json','cache-control':'no-store'}});
const billingEnvironment=()=>String(Deno.env.get('STRIPE_BILLING_ENV')||'test').toLowerCase()==='live'?'live':'test';
const appUrl=()=>Deno.env.get('RHYTHTAP_APP_URL')||'https://jonnyt123.github.io/Rhythtap/';
const stripeClient=()=>{const key=Deno.env.get('STRIPE_SECRET_KEY')||'';if(!key)throw new Error('Stripe billing is not configured');return new Stripe(key,{apiVersion:'2026-07-29.dahlia'})};
const adminClient=()=>{const url=Deno.env.get('SUPABASE_URL')||'',secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}'),key=String(secretKeys?.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');if(!url||!key)throw new Error('Server configuration missing');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})};
const authenticatedUserId=async(req:Request)=>{const url=Deno.env.get('SUPABASE_URL')||'',publishableKeys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}'),key=String(publishableKeys?.default||Deno.env.get('SUPABASE_ANON_KEY')||''),authorization=req.headers.get('authorization')||'',token=authorization.replace(/^Bearer\s+/i,'').trim();if(!url||!key)throw new Error('Server configuration missing');if(!token)throw new Error('Authentication required');const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}}),{data,error}=await client.auth.getUser(token);if(error||!data.user?.id)throw new Error('Authentication required');return data.user.id};

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const userId=await authenticatedUserId(req),environment=billingEnvironment(),admin=adminClient(),{data:billing,error}=await admin.from('player_billing_entitlements').select('stripe_customer_id').eq('user_id',userId).eq('environment',environment).maybeSingle();
  if(error)throw error;
  if(!billing?.stripe_customer_id)return json({error:'No Stripe customer is linked to this RhythmTap ID yet.'},404);
  const session=await stripeClient().billingPortal.sessions.create({customer:billing.stripe_customer_id,return_url:appUrl()});
  return json({url:session.url});
 }catch(error){
  const message=error instanceof Error?error.message:'Unable to open Stripe Customer Portal',status=/Authentication required/i.test(message)?401:/No Stripe customer/i.test(message)?404:/not configured|configuration/i.test(message)?503:400;
  return json({error:message},status);
 }
});
