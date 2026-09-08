// ids, password hashing (PBKDF2/WebCrypto), RAK envelope encryption (AES-GCM).
// Workers runtime: Web APIs only, no Node Buffer.
export const uid = (p = "id") =>
  `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(b: ArrayBuffer | Uint8Array): string {
  const v = b instanceof Uint8Array ? b : new Uint8Array(b);
  return [...v].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  return bytesToHex(bits);
}

async function masterKey(hex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", hexToBytes(hex), "AES-GCM", false, ["encrypt", "decrypt"]);
}

// Returns "ivHex:cipherHex". RAKs are encrypted at rest, never logged.
export async function encRak(rak: string, masterHex: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await masterKey(masterHex), new TextEncoder().encode(rak));
  return `${bytesToHex(iv)}:${bytesToHex(ct)}`;
}

export async function decRak(blob: string, masterHex: string): Promise<string> {
  const [ivH, ctH] = blob.split(":");
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: hexToBytes(ivH) },
    await masterKey(masterHex),
    hexToBytes(ctH),
  );
  return new TextDecoder().decode(pt);
}
