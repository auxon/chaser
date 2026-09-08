// Resend send. From our domain, reply-to theirs. No secrets in logs.
export async function sendEmail(
  env: Env,
  opts: { to: string; replyTo: string; subject: string; body: string },
): Promise<{ ok: boolean; id?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Chaser <nudge@chaser.example>",
      to: [opts.to],
      reply_to: opts.replyTo,
      subject: opts.subject,
      text: opts.body,
    }),
  });
  if (!res.ok) return { ok: false };
  const data = (await res.json()) as { id?: string };
  return { ok: true, id: data.id };
}
