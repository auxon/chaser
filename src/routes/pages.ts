// Server-rendered pages. Data loads client-side from /chaser/api/* (cookie auth).
import { Hono } from "hono";
import type { Env } from "../types";
import { esc, gbp, layout } from "../lib/html";

export const pages = new Hono<{ Bindings: Env }>();

pages.get("/", (c) =>
  c.html(
    layout(
      "Get paid without awkward emails",
      `<h1>Overdue invoices chase themselves.</h1>
<p class="mut">Add an overdue invoice. Chaser sends polite-to-firm reminders with a pay-now link, and stops the second you're paid.</p>
<div class="card"><div class="nums">
<div><div class="big">£29</div><div class="mut small">per month, flat</div></div>
<div><div class="big">14-day</div><div class="mut small">free trial</div></div>
<div><div class="big">5 min</div><div class="mut small">to set up</div></div>
</div></div>
<a class="btn" href="/chaser/signup">Start chasing — free trial</a>
<p class="small mut">Already have an account? <a href="/chaser/login">Log in</a></p>`,
    ),
  ),
);

const authForm = (mode: "signup" | "login") => {
  const extra =
    mode === "signup"
      ? `<label>Business name<input id="biz" placeholder="Acme Plumbing"></label>`
      : "";
  return layout(
    mode === "signup" ? "Sign up" : "Log in",
    `<h1>${mode === "signup" ? "Start your free trial" : "Welcome back"}</h1>
${extra}
<label>Email<input id="email" type="email" autocomplete="email"></label>
<label>Password<input id="pass" type="password" ${mode === "signup" ? 'autocomplete="new-password" placeholder="10+ characters"' : 'autocomplete="current-password"'}></label>
<button id="go">${mode === "signup" ? "Create account" : "Log in"}</button>
<div class="err" id="e"></div>
<script>
document.getElementById('go').onclick=async()=>{
const body={email:email.value,password:pass.value${mode === "signup" ? ",business_name:document.getElementById('biz').value" : ""}};
const r=await fetch('/chaser/api/auth/${mode}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const j=await r.json().catch(()=>({}));
if(!r.ok){show('e',j.error||'Something went wrong');return}
location.href='/chaser/onboarding'};</script>`,
  );
};

pages.get("/signup", (c) => c.html(authForm("signup")));
pages.get("/login", (c) => c.html(authForm("login")));

// Onboarding wizard: 1 subscribe -> 2 connect Stripe RAK -> 3 done.
pages.get("/onboarding", (c) =>
  c.html(
    layout(
      "Get set up",
      `<h1>Get set up in 5 minutes</h1>
<div class="step"><div class="n">1</div><div class="card" style="flex:1;margin:0">
<strong>Activate your subscription</strong><p class="mut small">£29/mo after a 14-day trial. Cancel anytime.</p>
<button id="sub">Subscribe</button></div></div>
<div class="step"><div class="n">2</div><div class="card" style="flex:1;margin:0">
<strong>Connect Stripe (to receive payments)</strong>
<p class="mut small">In your Stripe dashboard: Developers → API keys → create a <em>restricted</em> key with Checkout write access, then paste it here. It starts with <code>rk_</code>.</p>
<label>Restricted key<input id="rak" placeholder="rk_live_…" autocomplete="off"></label>
<button id="conn">Connect</button><div class="ok" id="cok"></div></div></div>
<div class="step"><div class="n">3</div><div class="card" style="flex:1;margin:0">
<strong>Add your first overdue invoice</strong><p class="mut small">Takes about a minute.</p>
<a class="btn" href="/chaser/app">Open dashboard</a></div></div>
<div class="err" id="e"></div>
<script>
(async()=>{const r=await api('/billing/status');if(r.status===402){return}const j=await r.json();
if(j.subscription==='active'||j.subscription==='trialing')document.getElementById('sub').textContent='Subscribed ✓';
if(j.stripeConnected)show('cok','Stripe connected ✓')})().catch(()=>{});
document.getElementById('sub').onclick=async()=>{const r=await api('/billing/subscribe',{method:'POST'});const j=await r.json();if(j.url)location.href=j.url;else show('e',j.error||'Could not start checkout')};
document.getElementById('conn').onclick=async()=>{const r=await api('/connect/rak',{method:'POST',body:JSON.stringify({rak:document.getElementById('rak').value.trim()})});const j=await r.json();if(!r.ok){show('e',j.error||'Key rejected');return}show('cok','Connected: '+esc(j.account||'Stripe'))};
function esc(s){return s}</script>`,
    ),
  ),
);

// Dashboard: three numbers + invoice list + add form.
pages.get("/app", (c) =>
  c.html(
    layout(
      "Dashboard",
      `<h1>Dashboard</h1><div class="nums">
<div class="card"><div class="mut small">Outstanding</div><div class="big" id="n_out">…</div></div>
<div class="card"><div class="mut small">Collected</div><div class="big" id="n_col">…</div></div>
<div class="card"><div class="mut small">Chasing</div><div class="big" id="n_ch">…</div></div></div>
<h2>Add overdue invoice</h2><div class="card">
<div class="row"><div><label>Client name<input id="dn"></label></div><div><label>Client email<input id="de" type="email"></label></div></div>
<div class="row"><div><label>Invoice #<input id="no" placeholder="INV-001"></label></div>
<div><label>Amount (£)<input id="amt" type="number" step="0.01" min="1"></label></div>
<div><label>Due date<input id="due" type="date"></label></div></div>
<button id="add">Start chasing</button><div class="err" id="e"></div></div>
<h2>Invoices</h2><div id="list"></div>
<script>
const money=p=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(p/100);
(async()=>{const r=await api('/dashboard');if(r.status===402){location.href='/chaser/onboarding';return}
const j=await r.json();n_out.textContent=money(j.totals.outstanding);n_col.textContent=money(j.totals.collected);n_ch.textContent=j.totals.chasing;
list.innerHTML=j.invoices.map(i=>'<div class="card inv"><div><a href="/chaser/app/invoices/'+i.id+'"><strong>'+esc(i.number)+'</strong></a><div class="mut small">'+esc(i.debtor_name)+' · '+money(i.amount_pence)+' · due '+esc(i.due_date)+'</div></div><span class="pill '+i.status+'">'+i.status.replace('_',' ')+'</span></div>').join('')||'<p class="mut">Nothing here yet — add your first invoice above.</p>'})().catch(()=>{});
document.getElementById('add').onclick=async()=>{const body={debtor_name:dn.value,debtor_email:de.value,number:no.value,amount_pence:Math.round(parseFloat(amt.value)*100),due_date:due.value};
const r=await api('/invoices',{method:'POST',body:JSON.stringify(body)});const j=await r.json();
if(!r.ok){show('e',j.error||'Check the form');return}location.reload()};
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</script>`,
    ),
  ),
);

// Invoice detail: timeline + pause / paid-cash.
pages.get("/app/invoices/:id", (c) => {
  const id = esc(c.req.param("id"));
  return c.html(
    layout(
      "Invoice",
      `<p><a href="/chaser/app">← Dashboard</a></p><h1 id="t">Invoice</h1>
<div id="meta"></div><h2>Timeline</h2><div class="tl" id="tl"></div>
<div class="row"><div><button id="pause" style="background:#666">Pause chasing</button></div>
<div><button id="cash" style="background:var(--go)">Mark paid (cash)</button></div></div>
<div class="err" id="e"></div>
<script>
const id='${id}';
(async()=>{const r=await api('/dashboard');const j=await r.json();
const inv=j.invoices.find(x=>x.id===id);if(!inv){t.textContent='Not found';return}
t.textContent='Invoice '+inv.number;
meta.innerHTML='<div class="card"><strong>'+inv.debtor_name+'</strong> · '+inv.amount_pence/100+' · due '+inv.due_date+' · <span class="pill '+inv.status+'">'+inv.status+'</span></div>';
tl.innerHTML=(j.timelines[id]||[]).map(e=>'<div>'+(e.subject?('✉️ '+e.subject+' <span class="mut small">'+e.sent_at+'</span>'):('💰 Paid '+(e.amount_pence/100)+' <span class="mut small">'+e.received_at+'</span>'))+'</div>').join('')||'<p class="mut">No reminders sent yet.</p>'})().catch(()=>{});
pause.onclick=async()=>{await api('/invoices/'+id+'/pause',{method:'POST'});location.reload()};
cash.onclick=async()=>{await api('/invoices/'+id+'/paid-cash',{method:'POST'});location.reload()};</script>`,
    ),
  );
});

export { esc as _esc, gbp as _gbp };
