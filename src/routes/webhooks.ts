// Webhooks — fulfillment lives HERE, never the success page.
// POST /webhooks/ours  (OUR billing: subscribe)
// POST /webhooks/collect (THEIR account: invoice paid -> halt sequence)
import { Hono } from "hono";
import type { Env } from "../types";
import { ourClient } from "../lib/stripe";
import { uid } from "../lib/crypto";

export const webhooks = new Hono<{ Bindings: Env }>();

async function verify(env: Env, stripe: { webhooks: { constructEventAsync: (p: string, s: string, e: string) => Promise<never> } }, secret: string, c: { req: { text: () => Promise<string>; header: (h: string) => string | undefined } }) {
  const payload = await c.req.text();
  const sig = c.req.header("stripe-signature") ?? "";
  return stripe.webhooks.constructEventAsync(payload, sig, secret);
}

webhooks.post("/ours", async (c) => {
  const stripe = ourClient(c.env);
  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = (await verify(c.env, stripe as never, c.env.STRIPE_WEBHOOK_SECRET, c)) as never;
  } catch {
    return c.json({ error: "bad_signature" }, 400);
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object as { customer?: string; subscription?: string; payment_status?: string };
    if (s.payment_status && s.payment_status !== "paid") return c.json({ received: true });
    const customer = (await stripe.customers.retrieve(s.customer as string)) as { metadata?: { chaser_user?: string } };
    const userId = customer.metadata?.chaser_user;
    if (userId) {
      await c.env.DB.prepare(
        "INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, updated_at) VALUES (?,?,?,'trialing',datetime('now')) " +
          "ON CONFLICT(user_id) DO UPDATE SET stripe_subscription_id=excluded.stripe_subscription_id, updated_at=datetime('now')",
      )
        .bind(userId, s.customer, s.subscription)
        .run();
    }
  }
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object as { id: string; status: string; customer: string };
    await c.env.DB.prepare("UPDATE subscriptions SET status=?, updated_at=datetime('now') WHERE stripe_subscription_id=?")
      .bind(sub.status, sub.id)
      .run();
  }
  return c.json({ received: true });
});

webhooks.post("/collect", async (c) => {
  // Signed with THEIR account's webhook secret (one shared endpoint; invoice matched via session id).
  const stripe = ourClient(c.env); // only for constructEventAsync (no API calls)
  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = (await verify(c.env, stripe as never, c.env.THEIR_WEBHOOK_SECRET, c)) as never;
  } catch {
    return c.json({ error: "bad_signature" }, 400);
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object as { id: string; payment_status?: string; amount_total?: number; metadata?: { chaser_invoice?: string } };
    if (s.payment_status && s.payment_status !== "paid") return c.json({ received: true });
    const invId = s.metadata?.chaser_invoice;
    if (!invId) return c.json({ received: true });
    await c.env.DB.prepare("UPDATE invoices SET status='paid' WHERE id=? AND status='chasing'")
      .bind(invId)
      .run();
    await c.env.DB.prepare("UPDATE sequence_runs SET halted=1 WHERE invoice_id=?").bind(invId).run();
    await c.env.DB.prepare(
      "INSERT OR IGNORE INTO payment_events (id, invoice_id, stripe_session_id, amount_pence) VALUES (?,?,?,?)",
    )
      .bind(uid("pay"), invId, s.id, s.amount_total ?? 0)
      .run();
  }
  return c.json({ received: true });
});
