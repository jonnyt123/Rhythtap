create table if not exists public.stripe_webhook_runtime_secrets (
  environment text primary key check (environment in ('test','live')),
  signing_secret text not null,
  updated_at timestamptz not null default now()
);

alter table public.stripe_webhook_runtime_secrets enable row level security;
revoke all on table public.stripe_webhook_runtime_secrets from anon, authenticated;
grant select on table public.stripe_webhook_runtime_secrets to service_role;

comment on table public.stripe_webhook_runtime_secrets is
  'Server-only Stripe webhook signing secrets used by Edge Functions; browser roles have no access.';
