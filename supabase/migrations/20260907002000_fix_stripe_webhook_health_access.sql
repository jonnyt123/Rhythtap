-- Edge Functions reach Postgres through the Data API, so keep webhook health in
-- public but lock it to service_role only. Browser roles get no privileges/policy.

create table if not exists public.stripe_webhook_health (
  id smallint primary key default 1 check (id = 1),
  last_received_at timestamptz,
  last_verified_at timestamptz,
  last_event_id text,
  last_event_type text,
  last_outcome text,
  last_error_code text,
  last_error_message text,
  updated_at timestamptz not null default now()
);

alter table public.stripe_webhook_health enable row level security;
revoke all on table public.stripe_webhook_health from public, anon, authenticated;
grant select, insert, update on table public.stripe_webhook_health to service_role;

drop policy if exists "Service role manages Stripe webhook health" on public.stripe_webhook_health;
create policy "Service role manages Stripe webhook health"
on public.stripe_webhook_health
for all
to service_role
using (true)
with check (true);

insert into public.stripe_webhook_health (id, last_outcome)
values (1, 'not_yet_received')
on conflict (id) do nothing;

comment on table public.stripe_webhook_health is
'Server-only Stripe webhook delivery/verification/processing health. No client privileges; contains no Stripe secret values.';

drop table if exists private.stripe_webhook_health;
