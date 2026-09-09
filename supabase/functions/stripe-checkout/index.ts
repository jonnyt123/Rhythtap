import Stripe from 'npm:stripe@22.4.0';
import {createClient} from 'npm:@supabase/supabase-js@2';

const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization, x-client-info, apikey, content-type','access-control-allow-methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json','cache-control':'no-store'}});
const billingEnvironment=()=>String(Deno.env.get('STRIPE_BILLING_ENV')||'test').toLowerCase()==='live'?'live':'test';
const configuredValue=(name:string)=>Deno.env.get(`${name}_${billingEnvironment().toUpperCase()}`)||Deno.env.get(name)||'';
const appUrl=()=>Deno.env.get('RHYTHTAP_APP_URL')||'https://jonnyt123.github.io/Rhythtap/';
const stripeSecretKey=()=>{
 const environment=billingEnvironment();
 const explicit=String(Deno.env.get(`STRIPE_SECRET_KEY_${environment.toUpperCase()}`)||'').trim();
 if(environment==='live'){
  if(!explicit)throw new Error('STRIPE_SECRET_KEY_LIVE is missing from Supabase Edge Function secrets');
  if(!/^(rk|sk)_live_/.test(explicit))throw new Error('STRIPE_SECRET_KEY_LIVE is not a live-mode Stripe key');
  return explicit;
 }
 const fallback=String(Deno.env.get('STRIPE_SECRET_KEY')||'').trim();
 const key=explicit||fallback;
 if(!key)throw new Error('Stripe test billing is not configured');
 if(/^(rk|sk)_live_/.test(key))throw new Error('Test billing cannot use a live-mode Stripe key');
 return key;
};
const stripeClient=()=>new Stripe(stripeSecretKey(),{apiVersion:'2026-07-29.dahlia'});
const adminClient=()=>{
 const url=Deno.env.get('SUPABASE_URL')||'',secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}'),key=String(secretKeys?.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');
 if(!url||!key)throw new Error('Server configuration missing');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
};
const authenticatedUser=async(req:Request)=>{
 const url=Deno.env.get('SUPABASE_URL')||'',publishableKeys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}'),key=String(publishableKeys?.default||Deno.env.get('SUPABASE_ANON_KEY')||''),authorization=req.headers.get('authorization')||'',token=authorization.replace(/^Bearer\s+/i,'').trim();
 if(!url||!key)throw new Error('Server configuration missing');
 if(!token)throw new Error('Authentication required');
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}}),{data,error}=await client.auth.getUser(token);
 if(error||!data.user?.id)throw new Error('Authentication required');
 return data.user;
};
const returnUrl=(state:'success'|'cancelled')=>{const url=new URL(appUrl());url.searchParams.set('billing',state);return url.toString()};
const isMissingCustomerError=(error:unknown)=>{
 const message=error instanceof Error?error.message:String(error||'');
 return /No such customer/i.test(message);
};

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const user=await authenticatedUser(req),body=await req.json().catch(()=>({})),interval=body?.interval==='monthly'?'monthly':'annual',environment=billingEnvironment();
  const monthly=configuredValue('STRIPE_PRICE_PRO_MONTHLY'),annual=configuredValue('STRIPE_PRICE_PRO_ANNUAL'),price=interval==='monthly'?monthly:annual;
  if(!price)throw new Error('Stripe price is not configured');
  const admin=adminClient(),{data:subscriptions,error:billingError}=await admin.from('player_billing_subscriptions').select('stripe_customer_id,status,last_event_created').eq('user_id',user.id).eq('environment',environment).order('last_event_created',{ascending:false});
  if(billingError)throw new Error('Unable to verify existing subscriptions');
  const active=(subscriptions||[]).find((row:any)=>['active','trialing','past_due'].includes(String(row.status))),billing=active||(subscriptions||[])[0]||null;
  if(active)return json({error:'RhythmTap Pro is already active. Manage it from your profile.'},409);
  const stripe=stripeClient();
  const baseParams:any={
   mode:'subscription',
   line_items:[{price,quantity:1}],
   success_url:returnUrl('success'),
   cancel_url:returnUrl('cancelled'),
   client_reference_id:user.id,
   metadata:{app:'rhythmtap',user_id:user.id,billing_environment:environment},
   subscription_data:{metadata:{app:'rhythmtap',user_id:user.id,billing_environment:environment}},
   allow_promotion_codes:true,
   integration_identifier:'rhythmtap_web_kqrmvexz',
  };
  if(user.email)baseParams.customer_email=user.email;
  let session;
  if(billing?.stripe_customer_id){
   const withCustomer={...baseParams,customer:billing.stripe_customer_id};
   delete withCustomer.customer_email;
   try{
    session=await stripe.checkout.sessions.create(withCustomer);
   }catch(error){
    if(!isMissingCustomerError(error))throw error;
    session=await stripe.checkout.sessions.create(baseParams);
   }
  }else{
   session=await stripe.checkout.sessions.create(baseParams);
  }
  if(!session.url)throw new Error('Stripe Checkout URL unavailable');
  return json({url:session.url,sessionId:session.id});
 }catch(error){
  const message=error instanceof Error?error.message:'Unable to start Stripe Checkout';
  const status=/Authentication required/i.test(message)?401:/already active/i.test(message)?409:/not configured|configuration|STRIPE_SECRET_KEY_LIVE|live-mode Stripe key|missing from Supabase/i.test(message)?503:400;
  return json({error:message},status);
 }
});
