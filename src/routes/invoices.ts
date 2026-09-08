// Invoices + debtors + pause / mark-paid-cash. Gated: login + active sub.
import { Hono } from "hono";
import type { Env } from "../types";
import { currentUser, requireActiveSub, requireUser } from "../lib/auth";
import { uid } from "../lib/crypto";

export const invoices = new Hono<{ Bindings: Env }>();
invoices.use(requireUser, requireActiveSub);

invoices.get("/", async (c) => {
  const u = currentUser(c);
  const rows = await c.env.DB.prepare(
    "SELECT i.*, d.name AS debtor_name, d.email AS debtor_email FROM invoices i JOIN debtors d ON d.id=i.debtor_id WHERE i.user_id=? ORDER BY i.created_at DESC",
  )
    .bind(u.userId)
    .all();
  return c.json({ invoices: rows.results });
});

invoices.post("/", async (c) => {
  const u = currentUser(c);
  const { debtor_name, debtor_email, number, amount_pence, currency, due_date } = await c.req.json();
  if (!debtor_name || !debtor_email || !number || !amount_pence || !due_date) {
    return c.json({ error: "debtor_name, debtor_email, number, amount_pence, due_date required" }, 400);
  }
  const debtorId = uid("d");
  await c.env.DB.prepare("INSERT INTO debtors (id, user_id, name, email) VALUES (?,?,?,?)")
    .bind(debtorId, u.userId, String(debtor_name), String(debtor_email).toLowerCase())
    .run();
  const invId = uid("inv");
  await c.env.DB.prepare(
    "INSERT INTO invoices (id, user_id, debtor_id, number, amount_pence, currency, due_date) VALUES (?,?,?,?,?,?,?)",
  )
    .bind(invId, u.userId, debtorId, String(number), Number(amount_pence), String(currency ?? "gbp"), String(due_date))
    .run();
  await c.env.DB.prepare("INSERT INTO sequence_runs (id, invoice_id) VALUES (?,?)")
    .bind(uid("run"), invId)
    .run();
  return c.json({ ok: true, id: invId });
});

invoices.post("/:id/pause", async (c) => {
  const u = currentUser(c);
  await c.env.DB.prepare("UPDATE invoices SET status='paused' WHERE id=? AND user_id=?")
    .bind(c.req.param("id"), u.userId)
    .run();
  await c.env.DB.prepare("UPDATE sequence_runs SET halted=1 WHERE invoice_id=?").bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

invoices.post("/:id/paid-cash", async (c) => {
  const u = currentUser(c);
  await c.env.DB.prepare("UPDATE invoices SET status='paid_cash' WHERE id=? AND user_id=?")
    .bind(c.req.param("id"), u.userId)
    .run();
  await c.env.DB.prepare("UPDATE sequence_runs SET halted=1 WHERE invoice_id=?").bind(c.req.param("id")).run();
  return c.json({ ok: true });
});
