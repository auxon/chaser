// Stripe helpers. Two clients: OURS (billing) and THEIRS (collection via RAK).
// Rules: StripeClient instances only, no payment_method_types, webhooks required.
import Stripe from "stripe";

export const ourClient = (env: Env) =>
  new Stripe(env.OUR_STRIPE_KEY, { apiVersion: "2026-08-26.dahlia" } as never);

export const theirClient = (rak: string) =>
  new Stripe(rak, { apiVersion: "2026-08-26.dahlia" } as never);

export const suffix = () => Math.random().toString(36).slice(2, 10);

// Validate a pasted RAK with one minimal read. Never log the key.
export async function validateRak(rak: string): Promise<{ ok: boolean; name?: string }> {
  try {
    const s = theirClient(rak);
    const bal = await s.balance.retrieve();
    void bal;
    const acct = await s.accounts.retrieve("self").catch(() => null);
    return { ok: true, name: (acct as { display_name?: string } | null)?.display_name ?? "Stripe account" };
  } catch {
    return { ok: false };
  }
}

// Collection link for ONE invoice. Dynamic payment methods (no payment_method_types).
export async function collectionCheckout(
  rak: string,
  opts: { amountPence: number; currency: string; invoiceNo: string; debtorEmail: string; successUrl: string; cancelUrl: string },
) {
  const s = theirClient(rak);
  return s.checkout.sessions.create({
    mode: "payment",
    customer_email: opts.debtorEmail,
    line_items: [
      {
        price_data: {
          currency: opts.currency,
          product_data: { name: `Invoice ${opts.invoiceNo} — via Chaser` },
          unit_amount: opts.amountPence,
        },
        quantity: 1,
      },
    ],
    metadata: { via: "chaser", invoice_no: opts.invoiceNo },
    integration_identifier: `chaser_collect_${suffix()}`,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });
}

// OUR billing: £29/mo subscribe with trial.
export async function subscribeCheckout(env: Env, userId: string, email: string) {
  const s = ourClient(env);
  const customer = await s.customers.create({ email, metadata: { chaser_user: userId } });
  return s.checkout.sessions.create({
    mode: "subscription",
    customer: customer.id,
    line_items: [{ price: env.PRICE_MONTHLY, quantity: 1 }],
    subscription_data: { trial_period_days: Number(env.TRIAL_DAYS ?? 14) },
    integration_identifier: `chaser_signup_${suffix()}`,
    success_url: `${env.APP_URL}/app?subscribed=1`,
    cancel_url: `${env.APP_URL}/?cancelled=1`,
  });
}
