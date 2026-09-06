import Stripe from 'npm:stripe@22.4.0';
import {createClient} from 'npm:@supabase/supabase-js@2';

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const stripeClient=()=>{const key=Deno.env.get('STRIPE_SECRET_KEY')||'';if(!key)throw new Error('Stripe billing is not configured');return new Stripe(key,{apiVersion:'2026-07-29.dahlia'})};
const adminClient=()=>{const url=Deno.env.get('SUPABASE_URL')||'',secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}'),key=String(secretKeys?.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');if(!url||!key)throw new Error('Server configuration missing');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})};
const environmentFor=(livemode:boolean)=>livemode?'live':'test';
const idOf=(value:any)=>typeof value==='string'?value:String(value?.id||'');
const activeFor=(status:string)=>['active','trialing','past_due'].includes(status);

async function resolveUserId(admin:any,subscription:any,environment:'test'|'live'){
 const metadataId=String(subscription?.metadata?.user_id||'');
 if(metadataId)return metadataId;
 const customerId=idOf(subscription?.customer);
 if(!customerId)return'';
 const{data}=await admin.from('player_billing_entitlements').select('user_id').eq('environment',environment).eq('stripe_customer_id',customerId).maybeSingle();
 return String(data?.user_id||'');
}

async function syncSubscription(stripe:Stripe,admin:any,subscription:any,event:Stripe.Event){
 const environment=environmentFor(event.livemode),userId=await resolveUserId(admin,subscription,environment);
 if(!userId)return;
 const item=subscription?.items?.data?.[0],priceId=idOf(item?.price),monthly=Deno.env.get('STRIPE_PRICE_PRO_MONTHLY')||'price_1UCZb6CJXJkpIFuEP85ED9as',annual=Deno.env.get('STRIPE_PRICE_PRO_ANNUAL')||'price_1UCZbDCJXJkpIFuESGS61NeB',billingInterval=priceId===annual?'annual':priceId===monthly?'monthly':null,status=String(subscription?.status||'inactive'),periodEnd=Number(item?.current_period_end||0),customerId=idOf(subscription?.customer),subscriptionId=idOf(subscription);
 const proEnabled=Boolean(billingInterval&&activeFor(status));
 const payload={user_id:userId,environment,stripe_customer_id:customerId||null,stripe_subscription_id:subscriptionId||null,status,price_id:priceId||null,billing_interval:billingInterval,pro_enabled:proEnabled,cancel_at_period_end:Boolean(subscription?.cancel_at_period_end),current_period_end:periodEnd?new Date(periodEnd*1000).toISOString():null,last_event_id:event.id,updated_at:new Date().toISOString()};
 const{error}=await admin.from('player_billing_entitlements').upsert(payload,{onConflict:'user_id,environment'});
 if(error)throw error;
}

async function syncSubscriptionId(stripe:Stripe,admin:any,subscriptionId:string,event:Stripe.Event){
 if(!subscriptionId)return;
 const subscription=await stripe.subscriptions.retrieve(subscriptionId,{expand:['items.data.price']});
 await syncSubscription(stripe,admin,subscription,event);
}

Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const secret=Deno.env.get('STRIPE_WEBHOOK_SECRET')||'',signature=req.headers.get('stripe-signature')||'';
  if(!secret||!signature)return json({error:'Webhook verification is not configured'},503);
  const stripe=stripeClient(),body=await req.text(),cryptoProvider=Stripe.createSubtleCryptoProvider(),event=await stripe.webhooks.constructEventAsync(body,signature,secret,undefined,cryptoProvider),admin=adminClient();
  if(event.type==='checkout.session.completed'){
   const session=event.data.object as any,subscriptionId=idOf(session.subscription);
   if(subscriptionId){
    const subscription=await stripe.subscriptions.retrieve(subscriptionId,{expand:['items.data.price']});
    const enriched:any=session.client_reference_id?{...subscription,metadata:{...subscription.metadata,user_id:String(session.client_reference_id)}}:subscription;
    await syncSubscription(stripe,admin,enriched,event);
   }
  }else if(event.type==='customer.subscription.created'||event.type==='customer.subscription.updated'||event.type==='customer.subscription.deleted'){
   await syncSubscription(stripe,admin,event.data.object as any,event);
  }else if(event.type==='invoice.payment_failed'||event.type==='invoice.paid'){
   const invoice:any=event.data.object,subscriptionId=idOf(invoice?.parent?.subscription_details?.subscription)||idOf(invoice?.subscription);
   await syncSubscriptionId(stripe,admin,subscriptionId,event);
  }
  return json({received:true});
 }catch(error){
  const message=error instanceof Error?error.message:'Stripe webhook failed';
  return json({error:message},400);
 }
});
