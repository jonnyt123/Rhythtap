import Stripe from 'npm:stripe@22.4.0';
import {createClient} from 'npm:@supabase/supabase-js@2';

const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization, x-client-info, apikey, content-type','access-control-allow-methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json','cache-control':'no-store'}});
const billingEnvironment=()=>String(Deno.env.get('STRIPE_BILLING_ENV')||'test').toLowerCase()==='live'?'live':'test';
const configuredValue=(name:string)=>Deno.env.get(`${name}_${billingEnvironment().toUpperCase()}`)||Deno.env.get(name)||'';
const appUrl=()=>Deno.env.get('RHYTHTAP_APP_URL')||'https://jonnyt123.github.io/Rhythtap/';
const stripeClient=()=>{
 const key=configuredValue('STRIPE_SECRET_KEY');
 if(!key)throw new Error('Stripe billing is not configured');
 return new Stripe(key,{apiVersion:'2026-07-29.dahlia'});
};
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
  const stripe=stripeClient(),params:any={
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
  if(billing?.stripe_customer_id)params.customer=billing.stripe_customer_id;
  else if(user.email)params.customer_email=user.email;
  const session=await stripe.checkout.sessions.create(params);
  if(!session.url)throw new Error('Stripe Checkout URL unavailable');
  return json({url:session.url,sessionId:session.id});
 }catch(error){
  const message=error instanceof Error?error.message:'Unable to start Stripe Checkout',status=/Authentication required/i.test(message)?401:/already active/i.test(message)?409:/not configured|configuration/i.test(message)?503:400;
  return json({error:message},status);
 }
});
