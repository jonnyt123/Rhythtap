-- Server-only health telemetry for Stripe webhook delivery and processing.
-- Kept in the private schema so no browser/client API can read or mutate it.

create table if not exists private.stripe_webhook_health (
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

revoke all on table private.stripe_webhook_health from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update on table private.stripe_webhook_health to service_role;

insert into private.stripe_webhook_health (id, last_outcome)
values (1, 'not_yet_received')
on conflict (id) do nothing;

comment on table private.stripe_webhook_health is
'Server-only Stripe webhook delivery/verification/processing health. Contains no Stripe secret values.';
