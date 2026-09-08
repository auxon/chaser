// GET /api/dashboard — three numbers + invoice list with timelines.
import { Hono } from "hono";
import type { Env } from "../types";
import { currentUser, requireActiveSub, requireUser } from "../lib/auth";

export const dashboard = new Hono<{ Bindings: Env }>();
dashboard.use(requireUser, requireActiveSub);

dashboard.get("/", async (c) => {
  const u = currentUser(c);
  const totals = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN status='chasing' THEN amount_pence ELSE 0 END),0) AS outstanding,
            COALESCE(SUM(CASE WHEN status='paid' THEN amount_pence ELSE 0 END),0) AS collected,
            COUNT(CASE WHEN status='chasing' THEN 1 END) AS chasing
     FROM invoices WHERE user_id=?`,
  )
    .bind(u.userId)
    .first<{ outstanding: number; collected: number; chasing: number }>();
  const inv = await c.env.DB.prepare(
    `SELECT i.id, i.number, i.amount_pence, i.currency, i.due_date, i.status,
            d.name AS debtor_name, r.step AS next_step
     FROM invoices i JOIN debtors d ON d.id=i.debtor_id
     LEFT JOIN sequence_runs r ON r.invoice_id=i.id
     WHERE i.user_id=? ORDER BY i.due_date ASC`,
  )
    .bind(u.userId)
    .all();
  const timelines: Record<string, unknown[]> = {};
  for (const row of (inv.results ?? []) as { id: string }[]) {
    const msgs = await c.env.DB.prepare(
      "SELECT m.step, m.subject, m.sent_at FROM messages m JOIN sequence_runs r ON r.id=m.run_id WHERE r.invoice_id=? ORDER BY m.sent_at ASC",
    )
      .bind(row.id)
      .all();
    const pays = await c.env.DB.prepare("SELECT amount_pence, received_at FROM payment_events WHERE invoice_id=?")
      .bind(row.id)
      .all();
    timelines[row.id] = [...(msgs.results ?? []), ...(pays.results ?? [])];
  }
  return c.json({ totals, invoices: inv.results, timelines });
});
