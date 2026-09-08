// Shared page shell: layout, styles, tiny fetch helper. No framework.
export function layout(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Chaser</title>
<style>
:root{--ink:#1a1a2e;--mut:#666;--line:#e5e5ef;--go:#0f7b3d;--warn:#b35400;--bad:#b3261e;--bg:#fafaff}
*{box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;color:var(--ink);background:var(--bg);margin:0}
.wrap{max-width:680px;margin:0 auto;padding:32px 20px 64px}
nav{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-bottom:1px solid var(--line);background:#fff}
nav a{color:var(--ink);text-decoration:none;font-weight:600}
.card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px;margin:16px 0}
.mut{color:var(--mut)}.small{font-size:13px}
label{display:block;font-weight:600;margin:12px 0 4px}
input,select{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:8px;font-size:16px}
button,.btn{display:inline-block;background:var(--ink);color:#fff;border:0;border-radius:8px;padding:12px 20px;font-size:16px;cursor:pointer;text-decoration:none;margin-top:16px}
button:disabled{opacity:.5}
.err{background:#fdecea;color:var(--bad);border-radius:8px;padding:10px 12px;margin-top:12px;display:none}
.ok{background:#e6f4ea;color:var(--go);border-radius:8px;padding:10px 12px;margin-top:12px;display:none}
.nums{display:flex;gap:12px}.nums .card{flex:1;text-align:center}
.nums .big{font-size:28px;font-weight:700}
.inv{display:flex;justify-content:space-between;align-items:center;gap:12px}
.inv a{color:var(--ink)}
.pill{font-size:12px;padding:3px 10px;border-radius:20px;background:#eee;white-space:nowrap}
.pill.chasing{background:#fff4e0;color:var(--warn)}.pill.paid,.pill.paid_cash{background:#e6f4ea;color:var(--go)}.pill.paused{background:#eee;color:var(--mut)}
.steps{counter-reset:s}.step{display:flex;gap:12px;margin:16px 0}.step .n{flex:0 0 32px;height:32px;border-radius:50%;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}
.tl{border-left:3px solid var(--line);margin:12px 0 0 6px;padding-left:16px}.tl div{margin:8px 0}
.row{display:flex;gap:8px}.row>*{flex:1}
</style></head><body>
<nav><a href="/chaser/">Chaser</a><span id="navr" class="small"></span></nav>
<div class="wrap">${body}</div>
<script>
async function api(path,opts={}){const r=await fetch('/chaser/api'+path,{headers:{'Content-Type':'application/json'},...opts});
if(r.status===401){location.href='/chaser/login';throw 0}return r}
function show(id,msg){const e=document.getElementById(id);e.textContent=msg;e.style.display='block'}
</script>
</body></html>`;
}

export function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export const gbp = (pence: number, cur = "gbp") => {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: String(cur).toUpperCase() }).format(pence / 100);
  } catch {
    return (pence / 100).toFixed(2);
  }
};
