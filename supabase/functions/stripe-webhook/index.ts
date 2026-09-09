import Stripe from 'npm:stripe@22.4.0';
import {createClient} from 'npm:@supabase/supabase-js@2';

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const billingEnvironment=()=>String(Deno.env.get('STRIPE_BILLING_ENV')||'test').toLowerCase()==='live'?'live':'test';
const configuredValue=(name:string,environment:'test'|'live')=>Deno.env.get(`${name}_${environment.toUpperCase()}`)||(billingEnvironment()===environment?Deno.env.get(name):'')||'';
const adminClient=()=>{const url=Deno.env.get('SUPABASE_URL')||'',secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}'),key=String(secretKeys?.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');if(!url||!key)throw new Error('Server configuration missing');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})};
const environmentFor=(livemode:boolean)=>livemode?'live':'test';
const idOf=(value:any)=>typeof value==='string'?value:String(value?.id||'');
const errorCode=(error:unknown)=>String((error as any)?.code||(error as any)?.type||'processing_failed').slice(0,100);
const errorMessage=(error:unknown)=>String(error instanceof Error?error.message:error||'processing failed').slice(0,300);
const webhookSecret=(environment:'test'|'live')=>configuredValue('STRIPE_WEBHOOK_SECRET',environment);
const verifier=new Stripe('sk_test_webhook_verification_only',{apiVersion:'2026-07-29.dahlia'});

async function updateHealth(admin:any,patch:Record<string,unknown>){
 try{await admin.from('stripe_webhook_health').upsert({id:1,...patch,updated_at:new Date().toISOString()},{onConflict:'id'})}catch{}
}

async function resolveUserId(admin:any,subscription:any,environment:'test'|'live'){
 const metadataId=String(subscription?.metadata?.user_id||'');
 if(metadataId)return metadataId;
 const customerId=idOf(subscription?.customer);
 if(!customerId)return'';
 const{data:storedSubscription}=await admin.from('player_billing_subscriptions').select('user_id').eq('environment',environment).eq('stripe_customer_id',customerId).limit(1).maybeSingle();
 if(storedSubscription?.user_id)return String(storedSubscription.user_id);
 const{data:entitlement}=await admin.from('player_billing_entitlements').select('user_id').eq('environment',environment).eq('stripe_customer_id',customerId).maybeSingle();
 return String(entitlement?.user_id||'');
}

async function syncCheckoutSession(admin:any,session:any,event:Stripe.Event){
 const environment=environmentFor(event.livemode),metadata=session?.metadata||{};
 if(String(metadata?.app||'')!=='rhythmtap')return;
 if(metadata?.billing_environment&&String(metadata.billing_environment)!==environment)throw new Error('Checkout billing environment mismatch');
 const userId=String(session?.client_reference_id||'').trim(),customerId=idOf(session?.customer),subscriptionId=idOf(session?.subscription);
 if(!userId||!customerId||!subscriptionId)throw new Error('Checkout session is missing RhythmTap billing identity');
 const monthly=configuredValue('STRIPE_PRICE_PRO_MONTHLY',environment),annual=configuredValue('STRIPE_PRICE_PRO_ANNUAL',environment),priceId=String(metadata?.price_id||'');
 const metadataInterval=String(metadata?.billing_interval||''),billingInterval=metadataInterval==='annual'||priceId===annual?'annual':metadataInterval==='monthly'||priceId===monthly?'monthly':null;
 if(!billingInterval||!priceId||(priceId!==monthly&&priceId!==annual))throw new Error('Checkout session price is not an approved RhythmTap Pro price');
 const paymentStatus=String(session?.payment_status||''),status=paymentStatus==='paid'||paymentStatus==='no_payment_required'?'active':'incomplete';
 const{error}=await admin.rpc('sync_player_billing_subscription',{
  p_environment:environment,p_subscription_id:subscriptionId,p_user_id:userId,p_customer_id:customerId,p_status:status,p_price_id:priceId,p_billing_interval:billingInterval,p_cancel_at_period_end:false,p_current_period_end:null,p_event_id:event.id,p_event_created:Math.max(0,event.created-60)
 });
 if(error)throw error;
}

async function syncSubscription(admin:any,subscription:any,event:Stripe.Event){
 const environment=environmentFor(event.livemode),userId=await resolveUserId(admin,subscription,environment);
 if(!userId)return;
 const item=subscription?.items?.data?.[0],priceId=idOf(item?.price),monthly=configuredValue('STRIPE_PRICE_PRO_MONTHLY',environment),annual=configuredValue('STRIPE_PRICE_PRO_ANNUAL',environment),recurringInterval=String(item?.price?.recurring?.interval||item?.plan?.interval||''),billingInterval=priceId===annual||recurringInterval==='year'?'annual':priceId===monthly||recurringInterval==='month'?'monthly':null,status=String(subscription?.status||'inactive'),periodEnd=Number(item?.current_period_end||0),customerId=idOf(subscription?.customer),subscriptionId=idOf(subscription);
 if(!customerId||!subscriptionId)throw new Error('Stripe subscription identity missing');
 const{error}=await admin.rpc('sync_player_billing_subscription',{p_environment:environment,p_subscription_id:subscriptionId,p_user_id:userId,p_customer_id:customerId,p_status:status,p_price_id:priceId||null,p_billing_interval:billingInterval,p_cancel_at_period_end:Boolean(subscription?.cancel_at_period_end),p_current_period_end:periodEnd?new Date(periodEnd*1000).toISOString():null,p_event_id:event.id,p_event_created:event.created});
 if(error)throw error;
}

Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 let admin:any;
 try{admin=adminClient()}catch(error){return json({error:errorMessage(error)},500)}
 await updateHealth(admin,{last_received_at:new Date().toISOString(),last_outcome:'received',last_error_code:null,last_error_message:null});
 const signature=req.headers.get('stripe-signature')||'',environments=(['test','live'] as const).filter(environment=>Boolean(webhookSecret(environment)));
 if(!environments.length){
  await updateHealth(admin,{last_outcome:'rejected',last_error_code:'webhook_secret_missing',last_error_message:'No Stripe webhook signing secret is configured'});
  return json({error:'Webhook verification is not configured'},503)
 }
 if(!signature){await updateHealth(admin,{last_outcome:'rejected',last_error_code:'signature_header_missing',last_error_message:'Stripe-Signature header is missing'});return json({error:'Webhook verification is not configured'},503)}
 let event:Stripe.Event|null=null,lastVerificationError:unknown=null;
 const body=await req.text(),cryptoProvider=Stripe.createSubtleCryptoProvider();
 for(const environment of environments){
  try{
   const verified=await verifier.webhooks.constructEventAsync(body,signature,webhookSecret(environment),undefined,cryptoProvider);
   if(environmentFor(verified.livemode)!==environment)throw new Error('Webhook mode does not match its configured signing secret');
   event=verified;break;
  }catch(error){lastVerificationError=error}
 }
 if(!event){
  await updateHealth(admin,{last_outcome:'rejected',last_error_code:'signature_verification_failed',last_error_message:errorMessage(lastVerificationError)});
  return json({error:'Invalid Stripe webhook signature'},400);
 }
 await updateHealth(admin,{last_verified_at:new Date().toISOString(),last_event_id:event.id,last_event_type:event.type,last_outcome:'verified',last_error_code:null,last_error_message:null});
 try{
  if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded'||event.type==='checkout.session.async_payment_failed'){
   await syncCheckoutSession(admin,event.data.object as any,event);
  }else if(event.type==='customer.subscription.created'||event.type==='customer.subscription.updated'||event.type==='customer.subscription.deleted'){
   await syncSubscription(admin,event.data.object as any,event);
  }
  await updateHealth(admin,{last_outcome:'processed',last_error_code:null,last_error_message:null});
  return json({received:true});
 }catch(error){
  await updateHealth(admin,{last_outcome:'processing_failed',last_error_code:errorCode(error),last_error_message:errorMessage(error)});
  return json({error:'Stripe webhook processing failed'},400);
 }
});
