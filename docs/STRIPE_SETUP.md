# RhythmTap Pro — Stripe launch setup

This branch implements the **sandbox/test-mode** RhythmTap Pro billing path. Core gameplay stays free; Pro is an optional entitlement.

## Sandbox catalog

- Product: `prod_VCzZvkNt8sAUiN` — RhythmTap Pro
- Monthly CAD: `price_1UCZb6CJXJkpIFuEP85ED9as` — CA$4.99/month
- Annual CAD: `price_1UCZbDCJXJkpIFuESGS61NeB` — CA$39.99/year
- Customer Portal configuration: `bpc_1UCrexCJXJkpIFuErSGWIHxI` — RhythmTap Pro Sandbox
- Lookup keys:
  - `rhythmtap_pro_monthly_cad`
  - `rhythmtap_pro_annual_cad`

These are sandbox objects. Never reuse their IDs in live mode.

## Supabase Edge Function configuration

Set secrets/config in **Supabase → Edge Functions → Secrets**. Never commit secret values.

- `STRIPE_SECRET_KEY` — restricted Stripe API key (`rk_`) with only the permissions RhythmTap needs.
- `STRIPE_WEBHOOK_SECRET` — required exact variable name for the signing secret of the matching Stripe endpoint.
- `STRIPE_BILLING_ENV=test`
- `STRIPE_PRICE_PRO_MONTHLY=price_1UCZb6CJXJkpIFuEP85ED9as`
- `STRIPE_PRICE_PRO_ANNUAL=price_1UCZbDCJXJkpIFuESGS61NeB`
- `RHYTHTAP_APP_URL=https://jonnyt123.github.io/Rhythtap/`
- `STRIPE_PORTAL_CONFIGURATION_ID` — optional in sandbox because the checked-in sandbox fallback is explicit; **required in live mode** with a separate live `bpc_...` ID.

The web build must use `VITE_STRIPE_BILLING_ENV=test` until all separate live objects are ready.

### Webhook-secret requirement

The webhook reads only `STRIPE_WEBHOOK_SECRET` and fails closed when that exact variable is absent. Its value must be the `whsec_...` signing secret issued for the matching Stripe Dashboard endpoint—not a Stripe CLI forwarding secret or a secret from another sandbox/live endpoint. Secret values are never logged or returned.

## Verified sandbox behavior

Real Stripe sandbox transactions/events have verified the billing state machine end to end:

- signed Stripe webhook delivery reaches Supabase and passes signature verification;
- active monthly subscription => `status=active`, `pro_enabled=true`;
- cancel-at-period-end => subscription remains active, `pro_enabled=true`, `cancel_at_period_end=true`;
- terminal cancellation => `status=canceled`, `pro_enabled=false`;
- declined initial payment => subscription `incomplete`, `pro_enabled=false`;
- corrected payment source + successful retry purchase => `status=active`, `pro_enabled=true`;
- cleanup cancellation returns the test user to `pro_enabled=false`.

The runtime intentionally grants Pro only for `active`, `trialing`, and `past_due`. `incomplete` and `incomplete_expired` never grant Pro.

`public.stripe_webhook_health` records only safe webhook delivery/outcome metadata. It is RLS-enabled, has no anon/authenticated privileges, and is service-role-only.

## Stripe webhook

Sandbox endpoint:

`https://hcaawhtkldabetxzptmc.supabase.co/functions/v1/stripe-webhook`

Subscribed events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

`verify_jwt = false` is intentional only for this endpoint because Stripe is the caller; the handler verifies Stripe's `Stripe-Signature` before processing billing state.

## Checkout contract

- Stripe-hosted Checkout
- Billing `mode=subscription`
- Dynamic payment methods; do **not** hard-code `payment_method_types`
- `integration_identifier=rhythmtap_web_kqrmvexz`
- signed-in Supabase user ID carried through Checkout/Subscription metadata
- no card data passes through RhythmTap

## Customer Portal

Sandbox portal configuration `bpc_1UCrexCJXJkpIFuErSGWIHxI` is active and configured with:

- payment-method updates;
- invoice history;
- customer email/tax-ID updates;
- cancellation at period end with cancellation feedback;
- subscription plan changes disabled;
- return URL `https://jonnyt123.github.io/Rhythtap/`.

`stripe-portal` passes an explicit configuration ID. Sandbox may use the checked-in sandbox fallback. Live mode fails closed unless `STRIPE_PORTAL_CONFIGURATION_ID` supplies a separate live configuration.

## Entitlement behavior

`player_billing_entitlements` is a client-read-only projection of authoritative Stripe state. Users can read only their own entitlement row under RLS; Stripe webhooks perform writes server-side.

Core songs, Tour, online battles, ranked scoring, calibration, and standard progression remain free.

## Tax

Automatic Stripe Tax remains deliberately **disabled**. Before enabling it, confirm the appropriate tax registrations, business/head-office settings, and product tax code. Sandbox transactions do not establish real tax-registration obligations or validate production collection.

## Remaining sandbox release gates

1. Finish PR21 mobile/theme physical-phone verification and merge it first.
2. Keep PR23 stacked until PR21 merges and require exact-head CI/review/Vercel gates.
3. Test the **signed-in RhythmTap UI** Upgrade button through hosted Checkout and confirm return to the app.
4. Test the **signed-in RhythmTap UI** Manage Subscription button through Customer Portal.
5. Keep live charging disabled until the separate live catalog, restricted key, webhook secret/endpoint, portal configuration, and tax decisions are ready.

## Live-mode sequence

1. Create separate live Product and monthly/annual Price objects.
2. Create a live restricted key with minimum permissions.
3. Create a separate live webhook endpoint and store its signing secret under exact `STRIPE_WEBHOOK_SECRET`.
4. Create a separate live Customer Portal configuration and set `STRIPE_PORTAL_CONFIGURATION_ID`.
5. Switch server/client billing environment variables to `live` only after those objects exist.
6. Confirm tax registrations/settings before enabling automatic tax.
7. Run one low-value live subscription and verify webhook-driven Pro entitlement before public launch.
