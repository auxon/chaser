import { Hono } from "hono";
import type { Env } from "./types";
import { auth } from "./routes/auth";
import { billing, connect } from "./routes/billing";
import { dashboard } from "./routes/dashboard";
import { invoices } from "./routes/invoices";
import { webhooks } from "./routes/webhooks";
import { tick } from "./lib/engine";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true, app: "chaser" }));
app.route("/api/auth", auth);
app.route("/api/billing", billing);
app.route("/api/connect", connect);
app.route("/api/invoices", invoices);
app.route("/api/dashboard", dashboard);
app.route("/webhooks", webhooks);

app.get("/", (c) =>
  c.html(`<!doctype html><html><body style="font-family:system-ui;max-width:640px;margin:40px auto">
<h1>Chaser</h1><p>Overdue invoices chase themselves. <a href="/app">Open the app</a></p>
<p>£29/mo · 14-day trial · cancel anytime.</p></body></html>`),
);

app.get("/app", (c) =>
  c.html(`<!doctype html><html><body style="font-family:system-ui;max-width:640px;margin:40px auto">
<h1>Chaser app</h1><p>API-first MVP. Use <code>/api/…</code> endpoints; full UI next.</p></body></html>`),
);

app.get("/paid", (c) =>
  c.html(`<!doctype html><html><body style="font-family:system-ui;max-width:640px;margin:40px auto">
<h1>Paid — thank you!</h1><p>Your payment went through. The reminders stop here.</p></body></html>`),
);

export default {
  fetch: app.fetch,
  // Sequence engine: every 15 minutes.
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(tick(env));
  },
};
