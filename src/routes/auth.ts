// POST /api/auth/signup|login, POST /api/auth/logout
import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "../types";
import { hashPassword, uid } from "../lib/crypto";

export const auth = new Hono<{ Bindings: Env }>();

auth.post("/signup", async (c) => {
  const { email, password, business_name } = await c.req.json();
  if (!email || !password || String(password).length < 10) {
    return c.json({ error: "email + 10-char password required" }, 400);
  }
  const id = uid("u");
  try {
    await c.env.DB.prepare(
      "INSERT INTO users (id, email, password_hash, business_name) VALUES (?,?,?,?)",
    )
      .bind(id, String(email).toLowerCase(), await hashPassword(String(password), c.env.SESSION_SALT), String(business_name ?? ""))
      .run();
  } catch (e) {
    if (String(e).includes("UNIQUE")) return c.json({ error: "email_taken" }, 409);
    throw e; // surface real DB errors, never mislabel them
  }
  const sid = uid("s");
  await c.env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?,?,datetime('now','+30 days'))")
    .bind(sid, id)
    .run();
  setCookie(c, "chaser_sid", sid, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 30 * 86400 });
  return c.json({ ok: true });
});

auth.post("/login", async (c) => {
  const { email, password } = await c.req.json();
  const row = await c.env.DB.prepare("SELECT id, password_hash FROM users WHERE email=?")
    .bind(String(email).toLowerCase())
    .first<{ id: string; password_hash: string }>();
  if (!row || row.password_hash !== (await hashPassword(String(password), c.env.SESSION_SALT))) {
    return c.json({ error: "bad_credentials" }, 401);
  }
  const sid = uid("s");
  await c.env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?,?,datetime('now','+30 days'))")
    .bind(sid, row.id)
    .run();
  setCookie(c, "chaser_sid", sid, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 30 * 86400 });
  return c.json({ ok: true });
});

auth.post("/logout", async (c) => {
  const { getCookie } = await import("hono/cookie");
  const sid = getCookie(c, "chaser_sid");
  if (sid) await c.env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(sid).run();
  deleteCookie(c, "chaser_sid", { path: "/" });
  return c.json({ ok: true });
});
