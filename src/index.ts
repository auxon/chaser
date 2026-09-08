import { Hono } from "hono";
import type { Env } from "./types";
import { auth } from "./routes/auth";
import { billing, connect } from "./routes/billing";
import { dashboard } from "./routes/dashboard";
import { invoices } from "./routes/invoices";
import { pages } from "./routes/pages";
import { webhooks } from "./routes/webhooks";
import { tick } from "./lib/engine";

const inner = new Hono<{ Bindings: Env }>();

inner.get("/health", (c) => c.json({ ok: true, app: "chaser" }));
inner.route("/api/auth", auth);
inner.route("/api/billing", billing);
inner.route("/api/connect", connect);
inner.route("/api/invoices", invoices);
inner.route("/api/dashboard", dashboard);
inner.route("/webhooks", webhooks);
inner.route("/", pages);

inner.get("/paid", (c) =>
  c.html(`<!doctype html><html><body style="font-family:system-ui;max-width:640px;margin:40px auto">
<h1>Paid — thank you!</h1><p>Your payment went through. The reminders stop here.</p></body></html>`),
);

// Served at entangleit.com/chaser* (route specificity beats the storefront
// wildcard). Mounted under /chaser so workers.dev serves it at /chaser/* too.
const app = new Hono<{ Bindings: Env }>();
app.route("/chaser", inner);
app.get("/chaser/", (c) => c.redirect("/chaser"));

export default {
  fetch: app.fetch,
  // Sequence engine: every 15 minutes.
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(tick(env));
  },
};
