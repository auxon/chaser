// node --test. WebCrypto is global in Node 22+, no Workers runtime needed.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bytesToHex, decRak, encRak, hashPassword, hexToBytes } from "../src/lib/crypto.ts";

describe("crypto", () => {
  it("hex round-trips", () => {
    assert.equal(bytesToHex(hexToBytes("00ffab12")), "00ffab12");
  });

  it("password hashing is deterministic per salt, differs per salt", async () => {
    const a1 = await hashPassword("0123456789ab", "aa".repeat(16));
    const a2 = await hashPassword("0123456789ab", "aa".repeat(16));
    const b = await hashPassword("0123456789ab", "bb".repeat(16));
    assert.equal(a1, a2);
    assert.notEqual(a1, b);
    assert.equal(a1.length, 64);
  });

  it("RAK encrypt/decrypt round-trips, ciphertext hides plaintext", async () => {
    const master = "cc".repeat(32);
    const blob = await encRak("rk_test_abcdef123456", master);
    assert.ok(!blob.includes("rk_test_abcdef123456"));
    assert.equal(await decRak(blob, master), "rk_test_abcdef123456");
  });
});
