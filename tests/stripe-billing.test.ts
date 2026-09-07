import {assert} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const checkout=await Deno.readTextFile('supabase/functions/stripe-checkout/index.ts');
const portal=await Deno.readTextFile('supabase/functions/stripe-portal/index.ts');
const webhook=await Deno.readTextFile('supabase/functions/stripe-webhook/index.ts');
const migration=await Deno.readTextFile('supabase/migrations/20260906062000_stripe_pro_billing.sql');
const webhookHealthMigration=await Deno.readTextFile('supabase/migrations/20260907002000_fix_stripe_webhook_health_access.sql');
const transform=await Deno.readTextFile('scripts/stripe-billing-transform.ts');
const ui=await Deno.readTextFile('src/stripe-billing.tsx');
const config=await Deno.readTextFile('supabase/config.toml');

Deno.test('Checkout uses hosted subscription Billing without hard-coded payment methods',()=>{
 assert(checkout.includes("mode:'subscription'"));
 assert(checkout.includes("integration_identifier:'rhythmtap_web_kqrmvexz'"));
 assert(!checkout.includes('payment_method_types'));
 assert(checkout.includes("subscription_data:{metadata:"));
 assert(checkout.includes("allow_promotion_codes:true"));
});

Deno.test('billing entitlements are webhook-driven and client read-only',()=>{
 assert(webhook.includes('constructEventAsync'));
 assert(webhook.includes("event.type==='customer.subscription.updated'"));
 assert(webhook.includes("event.type==='customer.subscription.deleted'"));
 assert(webhook.includes("event.type==='invoice.payment_failed'"));
 assert(migration.includes('enable row level security'));
 assert(migration.includes('revoke insert, update, delete'));
 assert(migration.includes('(select auth.uid()) = user_id'));
});

Deno.test('only paid or payment-recovery grace statuses enable Pro',()=>{
 assert(webhook.includes("const activeFor=(status:string)=>['active','trialing','past_due'].includes(status)"));
 assert(!webhook.includes("['active','trialing','past_due','incomplete']"));
 assert(!webhook.includes("['active','trialing','past_due','incomplete_expired']"));
});

Deno.test('sandbox and live billing data cannot overwrite each other',()=>{
 assert(migration.includes("environment in ('test','live')"));
 assert(migration.includes('primary key (user_id, environment)'));
 assert(webhook.includes("environmentFor=(livemode:boolean)=>livemode?'live':'test'"));
 assert(ui.includes('VITE_STRIPE_BILLING_ENV'));
});

Deno.test('customer self-service uses an explicit Stripe Customer Portal configuration',()=>{
 assert(portal.includes('billingPortal.sessions.create'));
 assert(portal.includes("configuration:portalConfiguration()"));
 assert(portal.includes("if(billingEnvironment()==='test')return 'bpc_1UCrexCJXJkpIFuErSGWIHxI'"));
 assert(portal.includes("throw new Error('Stripe Customer Portal is not configured for live billing')"));
 assert(portal.includes("Deno.env.get('STRIPE_PORTAL_CONFIGURATION_ID')"));
 assert(ui.includes('MANAGE SUBSCRIPTION'));
});

Deno.test('profile integration keeps core gameplay outside the paywall',()=>{
 assert(transform.includes('<BillingCard userId={account.userId}/>'));
 assert(ui.includes('Core songs, Tour, online battles, ranked scoring and standard progression stay free.'));
});

Deno.test('Stripe webhook bypasses Supabase JWT only because Stripe signature is verified',()=>{
 assert(config.includes('[functions.stripe-webhook]'));
 assert(config.includes('verify_jwt = false'));
 assert(webhook.includes("req.headers.get('stripe-signature')"));
 assert(webhook.includes('constructEventAsync'));
});

Deno.test('webhook secret compatibility fallback fails closed unless exactly one whsec secret exists',()=>{
 assert(webhook.includes("const exact=Deno.env.get('STRIPE_WEBHOOK_SECRET')||''"));
 assert(webhook.includes("value.startsWith('whsec_')"));
 assert(webhook.includes("matches.length===1?matches[0]:''"));
});

Deno.test('webhook health telemetry is service-only and records safe failure classes',()=>{
 assert(webhookHealthMigration.includes('enable row level security'));
 assert(webhookHealthMigration.includes('revoke all on table public.stripe_webhook_health from public, anon, authenticated'));
 assert(webhookHealthMigration.includes('to service_role'));
 assert(webhook.includes("last_error_code:'signature_verification_failed'"));
 assert(webhook.includes("'webhook_secret_missing'"));
 assert(webhook.includes("'webhook_and_stripe_keys_missing'"));
 assert(!webhook.includes('STRIPE_WEBHOOK_SECRET}'));
 assert(!webhook.includes('STRIPE_SECRET_KEY}'));
});
