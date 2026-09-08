// node --test (Node 24 runs .ts natively via type stripping).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SEQUENCES, dueForStep, render, type Vars } from "../src/lib/sequences.ts";

const V: Vars = {
  business: "Acme Plumbing",
  debtor: "Jo",
  number: "INV-42",
  amount: "£500.00",
  due: "2026-09-01",
  payUrl: "https://pay.example/s/123",
};

describe("sequences", () => {
  it("every step renders subject+body with merge tags filled", () => {
    for (const tone of Object.keys(SEQUENCES) as (keyof typeof SEQUENCES)[]) {
      assert.ok(SEQUENCES[tone].length >= 2, tone);
      for (const step of SEQUENCES[tone]) {
        const { subject, body } = render(step, V);
        assert.ok(subject.includes("INV-42"));
        assert.ok(body.includes("https://pay.example/s/123"));
        assert.ok(body.includes("Acme Plumbing"));
        assert.ok(!body.includes("debt collector") && !body.includes("lawyer"));
      }
    }
  });

  it("firm is a shorter fuse than friendly", () => {
    assert.ok(SEQUENCES.firm.length < SEQUENCES.friendly.length);
  });

  it("dueForStep accumulates day offsets", () => {
    const start = "2026-09-08T00:00:00.000Z";
    assert.equal(dueForStep(start, SEQUENCES.friendly, 0).toISOString(), start);
    const d4 = dueForStep(start, SEQUENCES.friendly, 1);
    assert.equal(d4.toISOString(), "2026-09-12T00:00:00.000Z");
  });
});
