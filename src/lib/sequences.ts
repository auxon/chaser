// Escalation copy. User-approved templates; merge tags only. Never a collector.
export type Tone = "friendly" | "balanced" | "firm";

export interface StepDef {
  day: number; // days after previous step (0 = immediately at chasing start)
  subject: (v: Vars) => string;
  body: (v: Vars) => string;
}

export interface Vars {
  business: string;
  debtor: string;
  number: string;
  amount: string; // formatted, e.g. £500.00
  due: string;
  payUrl: string;
}

const fmt = (v: Vars) => v;

export const SEQUENCES: Record<Tone, StepDef[]> = {
  friendly: [
    {
      day: 0,
      subject: (v) => `Quick nudge: invoice ${v.number} (${v.amount})`,
      body: (v) => `Hi ${v.debtor},\n\nHope you're well! Just a friendly nudge that invoice ${v.number} for ${v.amount} was due on ${v.due}.\n\nYou can pay securely here: ${v.payUrl}\n\nThanks so much,\n${v.business}`,
    },
    {
      day: 4,
      subject: (v) => `Following up: invoice ${v.number} is overdue`,
      body: (v) => `Hi ${v.debtor},\n\nFollowing up on invoice ${v.number} for ${v.amount} (due ${v.due}). If it's already on its way, please ignore this!\n\nPay securely: ${v.payUrl}\n\nBest,\n${v.business}`,
    },
    {
      day: 4,
      subject: (v) => `Final reminder: invoice ${v.number} (${v.amount})`,
      body: (v) => `Hi ${v.debtor},\n\nThis is a final reminder that invoice ${v.number} for ${v.amount} is now significantly overdue (due ${v.due}). Please pay here: ${v.payUrl}\n\nIf there's a problem with the invoice, reply to this email and we'll sort it.\n\n${v.business}`,
    },
    {
      day: 4,
      subject: (v) => `Invoice ${v.number}: your options from here`,
      body: (v) => `Hi ${v.debtor},\n\nInvoice ${v.number} for ${v.amount} remains unpaid. From here, ${v.business} may pause work, add contractual late fees where agreed, or seek independent advice. To avoid that, pay here: ${v.payUrl}\n\n${v.business}`,
    },
  ],
  balanced: [],
  firm: [],
};

// balanced = friendly steps 1-2, firm closers; firm = shorter fuse.
SEQUENCES.balanced = [SEQUENCES.friendly[0], SEQUENCES.friendly[1], { ...SEQUENCES.friendly[2], day: 3 }, { ...SEQUENCES.friendly[3], day: 3 }];
SEQUENCES.firm = [{ ...SEQUENCES.friendly[0], day: 0 }, { ...SEQUENCES.friendly[2], day: 2 }, { ...SEQUENCES.friendly[3], day: 3 }];

export function render(step: StepDef, v: Vars) {
  void fmt;
  return { subject: step.subject(v), body: step.body(v) };
}

export function dueForStep(startIso: string, steps: StepDef[], idx: number): Date {
  const start = new Date(startIso).getTime();
  const days = steps.slice(0, idx + 1).reduce((a, s) => a + s.day, 0);
  return new Date(start + days * 86_400_000);
}
