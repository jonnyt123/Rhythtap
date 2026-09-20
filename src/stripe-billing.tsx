import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Check,Crown,ExternalLink,RefreshCw,ShieldCheck,Sparkles} from 'lucide-react';
import {SUPABASE_ANON_KEY,SUPABASE_URL} from './multiplayer-common';
import {getAccountSupabaseClient} from './supabase-account-client';
import './stripe-billing.css';

type BillingEnvironment='test'|'live';
type BillingInterval='monthly'|'annual';
type BillingRow={
 user_id:string;
 environment:BillingEnvironment;
 stripe_customer_id:string|null;
 stripe_subscription_id:string|null;
 status:string;
 price_id:string|null;
 billing_interval:BillingInterval|null;
 pro_enabled:boolean;
 cancel_at_period_end:boolean;
 current_period_end:string|null;
 updated_at:string;
};
const billingEnvironment:BillingEnvironment=String(import.meta.env.VITE_STRIPE_BILLING_ENV||'test').toLowerCase()==='live'?'live':'test';
const getBillingClient=getAccountSupabaseClient;

const formatDate=(value:string|null)=>value?new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'}).format(new Date(value)):'—';
const activeStatus=(status:string)=>['active','trialing','past_due'].includes(status);

async function billingRequest(endpoint:string,body:Record<string,unknown>={}){
 const client=await getBillingClient(),{data}=await client.auth.getSession(),token=data?.session?.access_token;
 if(!token)throw new Error('Sign in to manage RhythmTap Pro.');
 const response=await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`,{
  method:'POST',
  headers:{'content-type':'application/json','apikey':SUPABASE_ANON_KEY,'authorization':`Bearer ${token}`},
  body:JSON.stringify(body),
 });
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(String(payload?.error||`Billing service unavailable (${response.status})`));
 return payload;
}

export function BillingCard({userId}:{userId:string|null}){
 const[row,setRow]=useState<BillingRow|null>(null),[loading,setLoading]=useState(Boolean(userId)),[action,setAction]=useState(''),[error,setError]=useState('');
 const pro=Boolean(row?.pro_enabled&&activeStatus(row.status));
 const interval=row?.billing_interval;
 const statusLabel=useMemo(()=>{
  if(!row)return'FREE';
  if(row.status==='past_due')return'PRO · PAYMENT ISSUE';
  if(pro&&row.cancel_at_period_end)return'PRO · ENDS THIS PERIOD';
  if(pro)return`PRO · ${(interval||'ACTIVE').toUpperCase()}`;
  return'FREE';
 },[row,pro,interval]);

 const refresh=useCallback(async()=>{
  if(!userId){setRow(null);setLoading(false);return}
  setLoading(true);setError('');
  try{
   const client=await getBillingClient(),{data, error:queryError}=await client.from('player_billing_entitlements').select('*').eq('user_id',userId).eq('environment',billingEnvironment).maybeSingle();
   if(queryError)throw queryError;
   setRow(data as BillingRow|null);
  }catch(e:any){setError(String(e?.message||e))}
  finally{setLoading(false)}
 },[userId]);

 useEffect(()=>{void refresh()},[refresh]);
 useEffect(()=>{const onFocus=()=>void refresh();window.addEventListener('focus',onFocus);return()=>window.removeEventListener('focus',onFocus)},[refresh]);
 useEffect(()=>{
  if(new URLSearchParams(location.search).get('billing')!=='success')return;
  let attempts=0;
  const timer=window.setInterval(()=>{attempts+=1;void refresh();if(attempts>=10)window.clearInterval(timer)},1500);
  return()=>window.clearInterval(timer);
 },[refresh]);

 const checkout=async(intervalChoice:BillingInterval)=>{
  setAction(intervalChoice);setError('');
  try{const payload=await billingRequest('stripe-checkout',{interval:intervalChoice});if(payload?.url)location.assign(String(payload.url));else throw new Error('Stripe Checkout did not return a URL.')}
  catch(e:any){setError(String(e?.message||e));setAction('')}
 };
 const portal=async()=>{
  setAction('portal');setError('');
  try{const payload=await billingRequest('stripe-portal');if(payload?.url)location.assign(String(payload.url));else throw new Error('Stripe Customer Portal did not return a URL.')}
  catch(e:any){setError(String(e?.message||e));setAction('')}
 };

 if(!userId)return null;
 return <section className={'billing-card '+(pro?'pro':'free')}>
  <div className="billing-head"><div className="billing-mark"><Crown/></div><div><small>RHYTHTAP MEMBERSHIP</small><h2>{statusLabel}</h2></div><span className={'billing-env '+billingEnvironment}>{billingEnvironment==='live'?'LIVE':'SANDBOX'}</span></div>
  {loading?<div className="billing-loading"><RefreshCw/> CHECKING STRIPE STATUS…</div>:pro?<>
   <p className="billing-copy">Pro is active on this RhythmTap ID. Your entitlement is synced from Stripe through signed webhooks.</p>
   <div className="billing-entitlements">
    <span><Check/> Premium cosmetics</span><span><Check/> Advanced performance history</span><span><Check/> Premium progression rewards</span><span><Check/> Future Pro content</span>
   </div>
   <div className="billing-meta"><span><small>STATUS</small><strong>{row?.status.toUpperCase()}</strong></span><span><small>{row?.cancel_at_period_end?'ACCESS UNTIL':'PERIOD END'}</small><strong>{formatDate(row?.current_period_end||null)}</strong></span></div>
   <button className="billing-primary" disabled={Boolean(action)} onClick={()=>void portal()}><ExternalLink/>{action==='portal'?'OPENING…':'MANAGE SUBSCRIPTION'}</button>
   <small className="billing-foot">Payment methods, invoices and cancellation are handled in Stripe Customer Portal.</small>
  </>:<>
   <p className="billing-copy">Core songs, Tour, online battles, ranked scoring and standard progression stay free. Pro adds optional cosmetics and deeper performance tools.</p>
   <div className="billing-price-grid">
    <button disabled={Boolean(action)} onClick={()=>void checkout('annual')}><Sparkles/><span><small>BEST VALUE</small><strong>CA$39.99 / YEAR</strong><em>about CA$3.33/month</em></span></button>
    <button disabled={Boolean(action)} onClick={()=>void checkout('monthly')}><span><small>MONTHLY</small><strong>CA$4.99 / MONTH</strong><em>cancel anytime</em></span></button>
   </div>
   <div className="billing-entitlements">
    <span><Check/> Premium note, receptor and UI cosmetics</span><span><Check/> Advanced stats and performance history</span><span><Check/> Premium progression cosmetics</span><span><Check/> Future premium content access</span>
   </div>
   <div className="billing-trust"><ShieldCheck/><span><strong>SECURE STRIPE CHECKOUT</strong><small>Payment details never pass through RhythmTap.</small></span></div>
  </>}
  {error&&<div className="billing-error">{error}</div>}
 </section>;
}
