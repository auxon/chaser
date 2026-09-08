// Cookie sessions (HttpOnly, 30d). Gate: must exist; billing gate separate.
import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import type { Env } from "../types";

export interface Authed {
  userId: string;
  email: string;
}

export async function requireUser(c: Context<{ Bindings: Env }>, next: Next) {
  const sid = getCookie(c, "chaser_sid");
  if (!sid) return c.json({ error: "unauthorized" }, 401);
  const row = await c.env.DB.prepare(
    "SELECT u.id, u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at > datetime('now')",
  )
    .bind(sid)
    .first<{ id: string; email: string }>();
  if (!row) return c.json({ error: "unauthorized" }, 401);
  c.set("user" as never, { userId: row.id, email: row.email } as Authed);
  await next();
}

export const currentUser = (c: Context): Authed => c.get("user" as never);

// Billing gate: trialing or active subscription required for chasing features.
export async function requireActiveSub(c: Context<{ Bindings: Env }>, next: Next) {
  const u = currentUser(c);
  const sub = await c.env.DB.prepare("SELECT status FROM subscriptions WHERE user_id=?")
    .bind(u.userId)
    .first<{ status: string }>();
  if (!sub || !["trialing", "active"].includes(sub.status)) {
    return c.json({ error: "subscription_required" }, 402);
  }
  await next();
}
