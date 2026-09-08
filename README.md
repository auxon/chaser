# Chaser — overdue invoices chase themselves

Tradespeople and freelancers add an overdue invoice; Chaser sends a
polite→firm email escalation with a pay-now link, stops the second it's
paid, and shows what's still outstanding. $29/mo USD, 14-day trial.

## Stack

Cloudflare Workers + D1, Stripe (our billing + their collection links),
Resend for email. TypeScript, Hono, zero frontend framework in MVP
(API-first, tiny HTML shell).

## Local dev

```bash
npm install
npm run db:local     # apply schema.sql to local D1
npm test             # unit tests (Node 24 runs .ts natively)

# sandbox Stripe keys, no registration needed:
stripe sandbox create

wrangler secret put OUR_STRIPE_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put THEIR_WEBHOOK_SECRET
wrangler secret put RAK_MASTER_KEY   # 32-byte hex
wrangler secret put RESEND_API_KEY
wrangler secret put SESSION_SALT
npm run dev
```

Stripe listen for webhooks locally:

```bash
stripe listen --forward-to localhost:8787/webhooks/ours
```

## Before deploy

```bash
wrangler d1 create chaser   # paste id into wrangler.toml
# create the $29/mo USD Price in YOUR Stripe dashboard -> PRICE_MONTHLY
npm run deploy
```

## How it works

```
signup -> subscribe (OUR Checkout, trial) -> paste THEIR Stripe RAK (rk_ only)
add invoice -> sequence run created (step 0)
cron 15m -> due? -> collection Checkout in THEIR account -> email w/ pay link
/webhooks/collect paid -> invoice=paid, run halted, Day-4 job provably skips
```

## Rules this repo follows

- `StripeClient` instances only; dynamic payment methods (no `payment_method_types`).
- Webhooks required; fulfillment in handlers for `checkout.session.completed`
  **and** `checkout.session.async_payment_succeeded`, gated on `payment_status`.
- Customer RAKs encrypted at rest (AES-GCM), never logged, never echoed.
  `rk_` only — `sk_` rejected at the API boundary.
- Every state change is an event row (`messages`, `payment_events`).
