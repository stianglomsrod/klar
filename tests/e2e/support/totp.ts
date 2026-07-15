import { createHmac } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIOD_SECONDS = 30;

function decodeBase32(value: string): Buffer {
  const normalized = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("Ugyldig TOTP-hemmelighet.");
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTotp(secret: string, timestamp = Date.now()): string {
  const counter = BigInt(Math.floor(timestamp / 1000 / PERIOD_SECONDS));
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", decodeBase32(secret))
    .update(counterBuffer)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, "0");
}

export async function generateFreshTotp(secret: string): Promise<string> {
  const elapsed = Math.floor(Date.now() / 1000) % PERIOD_SECONDS;
  const remaining = PERIOD_SECONDS - elapsed;
  if (remaining <= 10) {
    await new Promise((resolve) => setTimeout(resolve, (remaining + 1) * 1000));
  }
  return generateTotp(secret);
}
