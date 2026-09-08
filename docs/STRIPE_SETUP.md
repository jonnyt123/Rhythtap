# RhythmTap Pro — Stripe launch setup

This project supports isolated sandbox and live RhythmTap Pro billing. Core gameplay stays free; Pro is an optional entitlement.

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

When sandbox and live Stripe endpoints both target this same Edge Function URL, also set all four mode-specific values:

- `STRIPE_SECRET_KEY_TEST` and `STRIPE_WEBHOOK_SECRET_TEST`
- `STRIPE_SECRET_KEY_LIVE` and `STRIPE_WEBHOOK_SECRET_LIVE`

The unsuffixed `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` remain the exact required names for the environment selected by `STRIPE_BILLING_ENV`. Mode-specific values let the webhook verify the other endpoint without ever trying a test event against a live API key (or vice versa).

The web build must use `VITE_STRIPE_BILLING_ENV=test` until all separate live objects are ready.

### Webhook-secret requirement

`STRIPE_WEBHOOK_SECRET` must contain the `whsec_...` signing secret issued for the endpoint in the selected billing environment—not a Stripe CLI forwarding secret or a secret from another sandbox/live endpoint. If both modes share the function URL, copy each endpoint's own secret into its `_TEST` or `_LIVE` variable as described above. Secret values are never logged or returned.

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

`player_billing_subscriptions` stores each subscription separately and ignores older event snapshots. The entitlement projection chooses an active/trialing/past-due recognized Pro subscription before any inactive subscription, so a secondary or out-of-order cancellation cannot revoke valid access.

Core songs, Tour, online battles, ranked scoring, calibration, and standard progression remain free.

## Tax

Automatic Stripe Tax remains deliberately **disabled**. Before enabling it, confirm the appropriate tax registrations, business/head-office settings, and product tax code. Sandbox transactions do not establish real tax-registration obligations or validate production collection.

## Remaining release gates

1. Apply the subscription-projection migration before deploying the updated Checkout and webhook functions.
2. Install the exact test/live secrets described above; do not copy a secret between endpoints.
3. Test the **signed-in RhythmTap UI** Upgrade button through hosted Checkout and confirm webhook-driven Pro access.
4. Test the **signed-in RhythmTap UI** Manage Subscription button through Customer Portal, then cancel at period end and verify access remains until terminal cancellation.
5. Keep public live charging disabled until the low-value live sequence succeeds and Stripe payouts/identity verification is complete.

## Live-mode sequence

1. Use live Product `prod_VDJ7yj5sMO4P89`, monthly Price `price_1UCsUxFvBMeYT96gps3F5wvu`, and annual Price `price_1UCsUwFvBMeYT96ggNBbPsGE`.
2. Use a live restricted key with minimum permissions.
3. Store the live endpoint's own signing secret under `STRIPE_WEBHOOK_SECRET` (and `STRIPE_WEBHOOK_SECRET_LIVE` when both modes share the function URL).
4. Set `STRIPE_PORTAL_CONFIGURATION_ID=bpc_1UD01ZFvBMeYT96gZjYXFi8o`.
5. Switch server/client billing environment variables to `live` only after those objects exist.
6. Confirm tax registrations/settings before enabling automatic tax.
7. Run one low-value live subscription and verify webhook-driven Pro entitlement before public launch.
