// ids, password hashing (PBKDF2/WebCrypto), RAK envelope encryption (AES-GCM).
export const uid = (p = "id") =>
  `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const salt = Uint8Array.from(Buffer.from(saltHex, "hex"));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" }, key, 256);
  return Buffer.from(bits).toString("hex");
}

async function masterKey(hex: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(Buffer.from(hex, "hex"));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

// Returns "ivHex:cipherHex". RAKs are encrypted at rest, never logged.
export async function encRak(rak: string, masterHex: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await masterKey(masterHex), new TextEncoder().encode(rak));
  return `${Buffer.from(iv).toString("hex")}:${Buffer.from(ct).toString("hex")}`;
}

export async function decRak(blob: string, masterHex: string): Promise<string> {
  const [ivH, ctH] = blob.split(":");
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Uint8Array.from(Buffer.from(ivH, "hex")) },
    await masterKey(masterHex),
    Uint8Array.from(Buffer.from(ctH, "hex")),
  );
  return new TextDecoder().decode(pt);
}
