import {createClient} from 'npm:@supabase/supabase-js@2';

const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization, x-client-info, apikey, content-type','access-control-allow-methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json','cache-control':'no-store'}});
const billingEnvironment=()=>String(Deno.env.get('STRIPE_BILLING_ENV')||'test').toLowerCase()==='live'?'live':'test';
const LIVE_LINKS={monthly:'https://buy.stripe.com/14A7sL2BA6CX1dD1Fe7ss00',annual:'https://buy.stripe.com/7sYdR98ZY6CX8G52Ji7ss01'} as const;
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

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const user=await authenticatedUser(req),body=await req.json().catch(()=>({})),interval=body?.interval==='monthly'?'monthly':'annual',environment=billingEnvironment();
  if(environment!=='live')throw new Error('Sandbox Payment Links are not configured');
  const admin=adminClient(),{data:subscriptions,error:billingError}=await admin.from('player_billing_subscriptions').select('status,last_event_created').eq('user_id',user.id).eq('environment',environment).order('last_event_created',{ascending:false});
  if(billingError)throw new Error('Unable to verify existing subscriptions');
  const active=(subscriptions||[]).find((row:any)=>['active','trialing','past_due'].includes(String(row.status)));
  if(active)return json({error:'RhythmTap Pro is already active. Manage it from your profile.'},409);
  const url=new URL(LIVE_LINKS[interval]);
  url.searchParams.set('client_reference_id',user.id);
  return json({url:url.toString(),paymentLink:true,interval});
 }catch(error){
  const message=error instanceof Error?error.message:'Unable to start Stripe Checkout';
  const status=/Authentication required/i.test(message)?401:/already active/i.test(message)?409:/not configured|configuration/i.test(message)?503:400;
  return json({error:message},status);
 }
});
