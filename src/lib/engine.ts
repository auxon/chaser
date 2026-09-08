// Cron tick (every 15m): send due steps for chasing invoices with active subs.
// Skips: paused/paid invoices, halted runs, users without sub or RAK.
import type { Env } from "../types";
import { decRak } from "./crypto";
import { sendEmail } from "./email";
import { SEQUENCES, dueForStep, render, type Tone } from "./sequences";
import { collectionCheckout } from "./stripe";
import { uid } from "./crypto";

const money = (pence: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(pence / 100);

export async function tick(env: Env): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;
  const runs = await env.DB.prepare(
    `SELECT r.id AS run_id, r.step, i.*, d.name AS debtor_name, d.email AS debtor_email,
            u.business_name, u.tone, u.email AS owner_email, u.id AS user_id,
            (SELECT status FROM subscriptions s WHERE s.user_id=u.id) AS sub_status,
            (SELECT rak_enc FROM stripe_accounts a WHERE a.user_id=u.id) AS rak_enc
     FROM sequence_runs r
     JOIN invoices i ON i.id=r.invoice_id
     JOIN debtors d ON d.id=i.debtor_id
     JOIN users u ON u.id=i.user_id
     WHERE r.halted=0 AND i.status='chasing'`,
  ).all<Record<string, unknown>>();

  for (const row of runs.results ?? []) {
    const steps = SEQUENCES[(row.tone as Tone) ?? "friendly"] ?? SEQUENCES.friendly;
    const idx = Number(row.step);
    if (idx >= steps.length) {
      await env.DB.prepare("UPDATE sequence_runs SET halted=1 WHERE id=?").bind(row.run_id).run();
      skipped++;
      continue;
    }
    if (!["trialing", "active"].includes(String(row.sub_status)) || !row.rak_enc) {
      skipped++;
      continue;
    }
    if (dueForStep(String(row.created_at), steps, idx) > new Date()) {
      skipped++;
      continue; // not due yet
    }
    try {
      const rak = await decRak(String(row.rak_enc), env.RAK_MASTER_KEY);
      const session = await collectionCheckout(rak, {
        amountPence: Number(row.amount_pence),
        currency: String(row.currency),
        invoiceNo: String(row.number),
        debtorEmail: String(row.debtor_email),
        successUrl: `${env.APP_URL}/paid?inv=${row.id}`,
        cancelUrl: `${env.APP_URL}/app?inv=${row.id}`,
      });
      // tag the session to this invoice for the /collect webhook
      const { theirClient } = await import("./stripe");
      await theirClient(rak).checkout.sessions.update(session.id, {
        metadata: { via: "chaser", chaser_invoice: String(row.id) },
      });
      const { subject, body } = render(steps[idx], {
        business: String(row.business_name || "us"),
        debtor: String(row.debtor_name),
        number: String(row.number),
        amount: money(Number(row.amount_pence), String(row.currency)),
        due: String(row.due_date),
        payUrl: session.url ?? "",
      });
      const mail = await sendEmail(env, {
        to: String(row.debtor_email),
        replyTo: String(row.owner_email),
        subject,
        body,
      });
      if (!mail.ok) {
        skipped++;
        continue;
      }
      await env.DB.prepare(
        "INSERT INTO messages (id, run_id, step, to_email, subject, checkout_session_id) VALUES (?,?,?,?,?,?)",
      )
        .bind(uid("msg"), row.run_id, idx, String(row.debtor_email), subject, session.id)
        .run();
      await env.DB.prepare("UPDATE sequence_runs SET step=step+1 WHERE id=?").bind(row.run_id).run();
      sent++;
    } catch {
      skipped++; // never crash the tick; next run retries
    }
  }
  return { sent, skipped };
}
