// Our billing + RAK connect.
// POST /api/billing/subscribe -> OUR Checkout (trial) | GET /api/billing/status
// POST /api/connect/rak {rak} -> validate (minimal read) + store encrypted
import { Hono } from "hono";
import type { Env } from "../types";
import { currentUser, requireUser } from "../lib/auth";
import { encRak } from "../lib/crypto";
import { subscribeCheckout, validateRak } from "../lib/stripe";

export const billing = new Hono<{ Bindings: Env }>();
billing.use(requireUser);

billing.post("/subscribe", async (c) => {
  const u = currentUser(c);
  const session = await subscribeCheckout(c.env, u.userId, u.email);
  return c.json({ url: session.url });
});

billing.get("/status", async (c) => {
  const u = currentUser(c);
  const sub = await c.env.DB.prepare("SELECT status FROM subscriptions WHERE user_id=?")
    .bind(u.userId)
    .first<{ status: string }>();
  const rak = await c.env.DB.prepare("SELECT validated_at FROM stripe_accounts WHERE user_id=?")
    .bind(u.userId)
    .first<{ validated_at: string }>();
  return c.json({ subscription: sub?.status ?? "none", stripeConnected: !!rak });
});

export const connect = new Hono<{ Bindings: Env }>();
connect.use(requireUser);

connect.post("/rak", async (c) => {
  const u = currentUser(c);
  const { rak } = await c.req.json();
  if (!rak || !String(rak).startsWith("rk_")) {
    return c.json({ error: "restricted_key_required" }, 400); // rk_ only, never sk_
  }
  const v = await validateRak(String(rak));
  if (!v.ok) return c.json({ error: "key_invalid" }, 400);
  await c.env.DB.prepare(
    "INSERT INTO stripe_accounts (user_id, rak_enc, account_name, validated_at) VALUES (?,?,?,datetime('now')) " +
      "ON CONFLICT(user_id) DO UPDATE SET rak_enc=excluded.rak_enc, account_name=excluded.account_name, validated_at=datetime('now')",
  )
    .bind(u.userId, await encRak(String(rak), c.env.RAK_MASTER_KEY), v.name ?? "")
    .run();
  // NOTE: rak plaintext never logged; only validation result stored.
  return c.json({ ok: true, account: v.name });
});
