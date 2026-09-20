-- Stripe Billing entitlement projection for RhythmTap Pro.
-- Test and live Stripe data are separated so sandbox validation cannot overwrite live entitlement state.

create table if not exists public.player_billing_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  environment text not null default 'test' check (environment in ('test','live')),
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive',
  price_id text,
  billing_interval text check (billing_interval in ('monthly','annual') or billing_interval is null),
  pro_enabled boolean not null default false,
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  last_event_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, environment),
  unique (environment, stripe_customer_id),
  unique (environment, stripe_subscription_id)
);

alter table public.player_billing_entitlements enable row level security;

revoke all on table public.player_billing_entitlements from anon;
revoke insert, update, delete on table public.player_billing_entitlements from authenticated;
grant select on table public.player_billing_entitlements to authenticated;

drop policy if exists "Players can read own billing entitlement" on public.player_billing_entitlements;
create policy "Players can read own billing entitlement"
on public.player_billing_entitlements
for select
to authenticated
using ((select auth.uid()) = user_id);

comment on table public.player_billing_entitlements is
'Read-only client projection of Stripe subscription state. Writes are performed only by trusted Edge Functions using the Supabase secret key.';
