import {assert} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const checkout=await Deno.readTextFile('supabase/functions/stripe-checkout/index.ts');
const portal=await Deno.readTextFile('supabase/functions/stripe-portal/index.ts');
const webhook=await Deno.readTextFile('supabase/functions/stripe-webhook/index.ts');
const migration=await Deno.readTextFile('supabase/migrations/20260906062000_stripe_pro_billing.sql');
const webhookHealthMigration=await Deno.readTextFile('supabase/migrations/20260907002000_fix_stripe_webhook_health_access.sql');
const subscriptionProjectionMigration=await Deno.readTextFile('supabase/migrations/20260908081500_stripe_subscription_projection.sql');
const runtimeSecretMigration=await Deno.readTextFile('supabase/migrations/20260909103400_stripe_webhook_runtime_secret_store.sql');
const publicBadgeMigration=await Deno.readTextFile('supabase/migrations/20260909103500_public_pro_badge_lookup.sql');
const ui=await Deno.readTextFile('src/stripe-billing.tsx');
const badge=await Deno.readTextFile('src/pro-badge.tsx');
const playerAccount=await Deno.readTextFile('src/player-account.tsx');
const socialRanked=await Deno.readTextFile('src/tour-social-ranked.tsx');
const config=await Deno.readTextFile('supabase/config.toml');

Deno.test('Checkout uses authenticated live Stripe Payment Links without a server Stripe API key',()=>{
 assert(checkout.includes('const LIVE_LINKS='));
 assert(checkout.includes("environment='live'"));
 assert(checkout.includes("url.searchParams.set('client_reference_id',user.id)"));
 assert(checkout.includes("['active','trialing','past_due']"));
 assert(checkout.includes('if(billingError)throw'));
 assert(!checkout.includes('new Stripe('));
 assert(!checkout.includes('STRIPE_SECRET_KEY'));
 assert(!checkout.includes('payment_method_types'));
});

Deno.test('billing entitlements are webhook-driven and client read-only',()=>{
 assert(webhook.includes('constructEventAsync'));
 assert(webhook.includes("event.type==='checkout.session.completed'"));
 assert(webhook.includes("event.type==='customer.subscription.updated'"));
 assert(webhook.includes("event.type==='customer.subscription.deleted'"));
 assert(webhook.includes("admin.rpc('sync_player_billing_subscription'"));
 assert(subscriptionProjectionMigration.includes('last_event_created'));
 assert(subscriptionProjectionMigration.includes('excluded.last_event_created >= existing_row.last_event_created'));
 assert(migration.includes('enable row level security'));
 assert(migration.includes('revoke insert, update, delete'));
 assert(migration.includes('(select auth.uid()) = user_id'));
});

Deno.test('only paid or payment-recovery grace statuses enable Pro',()=>{
 assert(subscriptionProjectionMigration.includes("chosen.status in ('active','trialing','past_due')"));
 assert(!subscriptionProjectionMigration.includes("chosen.status in ('active','trialing','past_due','incomplete')"));
});

Deno.test('sandbox and live billing data cannot overwrite each other',()=>{
 assert(migration.includes("environment in ('test','live')"));
 assert(migration.includes('primary key (user_id, environment)'));
 assert(webhook.includes("environmentFor=(livemode:boolean)=>livemode?'live':'test'"));
 assert(ui.includes('VITE_STRIPE_BILLING_ENV'));
});

Deno.test('customer self-service uses the live no-code Stripe Customer Portal',()=>{
 assert(portal.includes('const LIVE_PORTAL_LOGIN='));
 assert(portal.includes("environment='live'"));
 assert(portal.includes(".eq('environment',environment)"));
 assert(portal.includes('noCodePortal:true'));
 assert(!portal.includes('billingPortal.sessions.create'));
 assert(!portal.includes('STRIPE_SECRET_KEY'));
 assert(ui.includes('MANAGE SUBSCRIPTION'));
});

Deno.test('Checkout and Portal cannot silently fall back to sandbox credentials',()=>{
 for(const source of [checkout,portal]){
  assert(source.includes("environment='live'"));
  assert(!source.includes('STRIPE_SECRET_KEY'));
  assert(!source.includes('billingEnvironment()'));
 }
 assert(checkout.includes('LIVE_LINKS'));
 assert(portal.includes('LIVE_PORTAL_LOGIN'));
});

Deno.test('profile integration keeps core gameplay outside the paywall',()=>{
 assert(playerAccount.includes("import {BillingCard} from './stripe-billing';"));
 assert(playerAccount.includes('<BillingCard userId={account.userId}/>'));
 assert(ui.includes('Core songs, Tour, online battles, ranked scoring and standard progression stay free.'));
});

Deno.test('Stripe webhook bypasses Supabase JWT only because Stripe signature is verified',()=>{
 assert(config.includes('[functions.stripe-webhook]'));
 assert(config.includes('verify_jwt = false'));
 assert(webhook.includes("req.headers.get('stripe-signature')"));
 assert(webhook.includes('constructEventAsync'));
});

Deno.test('live webhook secret is server-only and test secret keeps the exact configured name',()=>{
 assert(webhook.includes("admin.from('stripe_webhook_runtime_secrets')"));
 assert(webhook.includes("configuredValue('STRIPE_WEBHOOK_SECRET',environment)"));
 assert(runtimeSecretMigration.includes('enable row level security'));
 assert(runtimeSecretMigration.includes('revoke all on table public.stripe_webhook_runtime_secrets from anon, authenticated'));
 assert(runtimeSecretMigration.includes('to service_role'));
 assert(!webhook.includes('Deno.env.toObject()'));
 assert(!webhook.includes("value.startsWith('whsec_')"));
});

Deno.test('webhook subscription lookup does not shadow the event subscription',()=>{
 assert(webhook.includes('data:storedSubscription'));
 assert(!webhook.includes('const{data:subscription}='));
});

Deno.test('verified subscription and Checkout events are projected without a second Stripe account lookup',()=>{
 assert(webhook.includes("event.type==='checkout.session.completed'"));
 assert(webhook.includes("event.type==='customer.subscription.created'||event.type==='customer.subscription.updated'||event.type==='customer.subscription.deleted'"));
 assert(webhook.includes('await syncSubscription(admin,event.data.object as any,event)'));
 assert(!webhook.includes('subscriptions.retrieve'));
});

Deno.test('webhook projections never refetch signed Stripe event objects',()=>{
 assert(!webhook.includes('subscriptions.retrieve'));
 assert(!webhook.includes('async function syncSubscriptionId'));
});

Deno.test('verified recurring price data can classify billing when an environment price ID is stale',()=>{
 assert(webhook.includes("recurringInterval==='year'?'annual'"));
 assert(webhook.includes("recurringInterval==='month'?'monthly'"));
});

Deno.test('webhook health telemetry is service-only and records safe failure classes',()=>{
 assert(webhookHealthMigration.includes('enable row level security'));
 assert(webhookHealthMigration.includes('revoke all on table public.stripe_webhook_health from public, anon, authenticated'));
 assert(webhookHealthMigration.includes('to service_role'));
 assert(webhook.includes("last_error_code:'signature_verification_failed'"));
 assert(webhook.includes("last_error_code:'webhook_secret_lookup_failed'"));
 assert(webhook.includes("last_error_code:'webhook_secret_missing'"));
 assert(!webhook.includes('STRIPE_WEBHOOK_SECRET}'));
 assert(!webhook.includes('STRIPE_SECRET_KEY}'));
});

Deno.test('one webhook function safely supports separate test and live endpoints',()=>{
 assert(webhook.includes("for(const environment of ['test','live'] as const)"));
 assert(webhook.includes("environmentFor(verified.livemode)!==environment"));
 assert(webhook.includes('configured.push({environment,secret})'));
});

Deno.test('public Pro badge is server-derived from live entitlements and cannot be profile-spoofed',()=>{
 assert(publicBadgeMigration.includes('security definer'));
 assert(publicBadgeMigration.includes("e.environment = 'live'"));
 assert(publicBadgeMigration.includes('coalesce(e.pro_enabled, false)'));
 assert(publicBadgeMigration.includes('(p.is_public or p.user_id = (select auth.uid()))'));
 assert(publicBadgeMigration.includes('grant execute on function public.get_visible_player_pro_badges(uuid[]) to anon, authenticated'));
 assert(badge.includes("client.rpc('get_visible_player_pro_badges'"));
 assert(playerAccount.includes('proBadge:Boolean(row.pro_badge)'));
 assert(socialRanked.includes('proBadge:Boolean(r.pro_badge)'));
 assert(!playerAccount.includes('pro_badge:input'));
});

Deno.test('browser features share one persistent Supabase auth client',async()=>{
 const shared=await Deno.readTextFile('src/supabase-account-client.ts');
 const sources=await Promise.all(['player-account.tsx','stripe-billing.tsx','engagement-analytics.ts','tour-set-career.tsx','tour-social-ranked.tsx'].map(name=>Deno.readTextFile(`src/${name}`)));
 assert(shared.includes("storageKey:'rhythtap-account-auth'"));
 for(const source of sources)assert(source.includes("from './supabase-account-client'"));
 assert(sources.every(source=>!source.includes('module.createClient(')));
});
