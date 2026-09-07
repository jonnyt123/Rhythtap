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
- `STRIPE_WEBHOOK_SECRET` — signing secret for the `stripe-webhook` endpoint. **The name must match exactly.**
- `STRIPE_BILLING_ENV=test`
- `STRIPE_PRICE_PRO_MONTHLY=price_1UCZb6CJXJkpIFuEP85ED9as`
- `STRIPE_PRICE_PRO_ANNUAL=price_1UCZbDCJXJkpIFuESGS61NeB`
- `RHYTHTAP_APP_URL=https://jonnyt123.github.io/Rhythtap/`

The web build should use `VITE_STRIPE_BILLING_ENV=test` until the live catalog and live webhook are ready.

### Current sandbox verification

A real sandbox subscription probe confirmed:

- Stripe can deliver subscription events to the Supabase Edge Function URL.
- `STRIPE_SECRET_KEY` is present in the Edge Function runtime.
- `STRIPE_WEBHOOK_SECRET` is currently **not visible under that exact runtime variable name**, so deliveries are rejected before signature verification.
- The disposable probe was canceled and created no player entitlement row.

No secret values are logged or stored in the health telemetry. `public.stripe_webhook_health` is RLS-enabled, has no browser-role privileges, and is writable/readable only by the service role.

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

## Customer Portal

A default sandbox Customer Portal configuration must be enabled in Stripe before the in-game **Manage Subscription** action can work. Configure payment-method updates, invoice/history access, and cancellation at period end. The current Stripe API connection exposes portal configuration reads but not portal configuration creation, so activation is a Dashboard step.

## Tax

Automatic Stripe Tax is deliberately **not enabled** in this branch. Before enabling `automatic_tax`, confirm RhythmTap has the appropriate active tax registration(s), head-office settings, and a confirmed product tax code. Enabling Stripe Tax without active registrations can result in zero tax being collected without an error. Sandbox transactions also do not count toward Stripe Tax threshold monitoring.

## Go-live sequence

1. Finish PR21 mobile/theme verification and merge it.
2. Keep the Stripe billing PR stacked until PR21 is merged; require exact-head CI/review/preview gates.
3. Confirm `STRIPE_SECRET_KEY` and exact-name `STRIPE_WEBHOOK_SECRET` are visible to the Supabase Edge Function runtime.
4. Re-run a signed sandbox Checkout and confirm webhook health reaches `processed` and the correct Pro entitlement is written.
5. Enable/configure the sandbox Customer Portal and verify cancel-at-period-end/payment-method management.
6. Test failed-payment/recovery behavior.
7. Create live Product/Price objects; do **not** reuse sandbox IDs.
8. Configure a live restricted key and a separate live webhook endpoint/signing secret.
9. Switch `STRIPE_BILLING_ENV` and `VITE_STRIPE_BILLING_ENV` to `live` only after live infrastructure is ready.
10. Confirm tax registrations/settings before enabling automatic tax.
11. Run one low-value live subscription and verify webhook-driven Pro entitlement before public launch.
