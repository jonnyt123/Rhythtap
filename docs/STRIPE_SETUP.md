# RhythmTap Pro — Stripe launch setup

This branch implements the **test-mode** RhythmTap Pro billing path. Core gameplay remains free; Pro is an optional entitlement.

## Sandbox catalog

- Product: `prod_VCzZvkNt8sAUiN` — RhythmTap Pro
- Monthly CAD: `price_1UCZb6CJXJkpIFuEP85ED9as` — CA$4.99/month
- Annual CAD: `price_1UCZbDCJXJkpIFuESGS61NeB` — CA$39.99/year
- Lookup keys:
  - `rhythmtap_pro_monthly_cad`
  - `rhythmtap_pro_annual_cad`

These are sandbox objects. Create separate live-mode Product/Price objects before launch.

## Required Supabase Edge Function secrets

Set these in **Supabase → Edge Functions → Secrets**. Never commit them.

- `STRIPE_SECRET_KEY` — use a Stripe **restricted API key (`rk_`)** rather than a broad secret key where possible. It needs the minimum permissions required for Checkout Sessions, Billing Portal Sessions, Customers/Subscriptions reads, and Prices reads.
- `STRIPE_WEBHOOK_SECRET` — signing secret for the `stripe-webhook` endpoint.
- `STRIPE_BILLING_ENV=test`
- `STRIPE_PRICE_PRO_MONTHLY=price_1UCZb6CJXJkpIFuEP85ED9as`
- `STRIPE_PRICE_PRO_ANNUAL=price_1UCZbDCJXJkpIFuESGS61NeB`
- `RHYTHTAP_APP_URL=https://jonnyt123.github.io/Rhythtap/`

The web build should use `VITE_STRIPE_BILLING_ENV=test` until the live catalog and live webhook are ready.

## Stripe webhook

Point a Stripe test-mode webhook endpoint at:

`https://hcaawhtkldabetxzptmc.supabase.co/functions/v1/stripe-webhook`

Subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

The webhook verifies the Stripe signature before using the Supabase secret key. `verify_jwt = false` is intentional only for this endpoint because Stripe, not a Supabase user, is the caller.

## Entitlement behavior

`player_billing_entitlements` is a read-only client projection of current Stripe state.

Pro access is enabled for recognized RhythmTap Pro prices while the Stripe subscription is:

- `active`
- `trialing`
- `past_due` (short payment-recovery grace)

Access is removed when the current Stripe subscription state no longer qualifies. Customer Portal is the only self-service cancellation/payment-method surface.

## Checkout contract

- Stripe-hosted Checkout
- Billing `mode=subscription`
- Dynamic payment methods (do **not** set `payment_method_types`)
- `integration_identifier=rhythmtap_web_kqrmvexz`
- Customer identity linked to the signed-in Supabase user through Checkout and Subscription metadata
- No card data passes through RhythmTap

## Tax

Automatic Stripe Tax is deliberately **not enabled** in this branch. Before enabling `automatic_tax`, confirm RhythmTap has the appropriate active tax registration(s), head-office settings, and a confirmed product tax code. Enabling Stripe Tax without active registrations can result in zero tax being collected without an error. Sandbox transactions also do not count toward Stripe Tax threshold monitoring.

## Go-live sequence

1. Finish PR21 mobile/theme verification and merge it.
2. Merge the Stripe billing PR only after its CI, review, and preview gates are green.
3. Set the sandbox restricted key + webhook signing secret in Supabase.
4. Deploy the three Stripe Edge Functions and the billing migration.
5. Run sandbox Checkout, renewal/failure, cancellation-at-period-end, and Customer Portal tests.
6. Create live Product/Price objects; do **not** reuse sandbox IDs.
7. Configure live restricted key and a separate live webhook signing secret.
8. Switch `STRIPE_BILLING_ENV` and `VITE_STRIPE_BILLING_ENV` to `live`.
9. Confirm tax registrations/settings before enabling automatic tax.
10. Run one low-value live subscription and verify webhook-driven Pro entitlement before public launch.
