-- Preserve each Stripe subscription independently, then derive one user entitlement.
-- This prevents an older or secondary subscription event from revoking a valid Pro subscription.

create table if not exists public.player_billing_subscriptions (
  environment text not null check (environment in ('test','live')),
  stripe_subscription_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  status text not null,
  price_id text,
  billing_interval text check (billing_interval in ('monthly','annual') or billing_interval is null),
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  last_event_id text not null,
  last_event_created bigint not null,
  updated_at timestamptz not null default now(),
  primary key (environment, stripe_subscription_id)
);

alter table public.player_billing_subscriptions enable row level security;
revoke all on table public.player_billing_subscriptions from public, anon, authenticated;
grant all on table public.player_billing_subscriptions to service_role;

insert into public.player_billing_subscriptions (
  environment, stripe_subscription_id, user_id, stripe_customer_id, status, price_id,
  billing_interval, cancel_at_period_end, current_period_end, last_event_id,
  last_event_created, updated_at
)
select environment, stripe_subscription_id, user_id, stripe_customer_id, status, price_id,
       billing_interval, cancel_at_period_end, current_period_end,
       coalesce(last_event_id, 'migration'), 0, updated_at
from public.player_billing_entitlements
where stripe_subscription_id is not null and stripe_customer_id is not null
on conflict (environment, stripe_subscription_id) do nothing;

create or replace function public.sync_player_billing_subscription(
  p_environment text,
  p_subscription_id text,
  p_user_id uuid,
  p_customer_id text,
  p_status text,
  p_price_id text,
  p_billing_interval text,
  p_cancel_at_period_end boolean,
  p_current_period_end timestamptz,
  p_event_id text,
  p_event_created bigint
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.player_billing_subscriptions as existing_row (
    environment, stripe_subscription_id, user_id, stripe_customer_id, status, price_id,
    billing_interval, cancel_at_period_end, current_period_end, last_event_id,
    last_event_created, updated_at
  ) values (
    p_environment, p_subscription_id, p_user_id, p_customer_id, p_status, p_price_id,
    p_billing_interval, p_cancel_at_period_end, p_current_period_end, p_event_id,
    p_event_created, now()
  )
  on conflict (environment, stripe_subscription_id) do update set
    user_id = excluded.user_id,
    stripe_customer_id = excluded.stripe_customer_id,
    status = excluded.status,
    price_id = excluded.price_id,
    billing_interval = excluded.billing_interval,
    cancel_at_period_end = excluded.cancel_at_period_end,
    current_period_end = excluded.current_period_end,
    last_event_id = excluded.last_event_id,
    last_event_created = excluded.last_event_created,
    updated_at = excluded.updated_at
  where excluded.last_event_created >= existing_row.last_event_created;

  insert into public.player_billing_entitlements as entitlement (
    user_id, environment, stripe_customer_id, stripe_subscription_id, status, price_id,
    billing_interval, pro_enabled, cancel_at_period_end, current_period_end,
    last_event_id, updated_at
  )
  select p_user_id, p_environment, chosen.stripe_customer_id, chosen.stripe_subscription_id,
         chosen.status, chosen.price_id, chosen.billing_interval,
         chosen.status in ('active','trialing','past_due') and chosen.billing_interval is not null,
         chosen.cancel_at_period_end, chosen.current_period_end, chosen.last_event_id, now()
  from (
    select subscriptions.*
    from public.player_billing_subscriptions subscriptions
    where subscriptions.user_id = p_user_id and subscriptions.environment = p_environment
    order by
      (subscriptions.status in ('active','trialing','past_due') and subscriptions.billing_interval is not null) desc,
      subscriptions.last_event_created desc,
      subscriptions.updated_at desc
    limit 1
  ) chosen
  on conflict (user_id, environment) do update set
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    status = excluded.status,
    price_id = excluded.price_id,
    billing_interval = excluded.billing_interval,
    pro_enabled = excluded.pro_enabled,
    cancel_at_period_end = excluded.cancel_at_period_end,
    current_period_end = excluded.current_period_end,
    last_event_id = excluded.last_event_id,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.sync_player_billing_subscription(text,text,uuid,text,text,text,text,boolean,timestamptz,text,bigint) from public, anon, authenticated;
grant execute on function public.sync_player_billing_subscription(text,text,uuid,text,text,text,text,boolean,timestamptz,text,bigint) to service_role;
