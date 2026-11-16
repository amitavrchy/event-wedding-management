import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** RFC 4648 base32 without padding, as used by authenticator apps. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(buffer: Buffer) {
  let bits = 0,
    value = 0,
    output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}
export function base32Decode(input: string) {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0,
    value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Invalid base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** RFC 4226 HOTP / RFC 6238 TOTP with SHA-1, 6 digits, 30 second steps. */
export function hotp(secret: Buffer, counter: number) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, "0");
}
export function totp(secretBase32: string, at = Date.now()) {
  return hotp(base32Decode(secretBase32), Math.floor(at / 30000));
}
/** Accepts the current step and one step either side for clock drift. */
export function verifyTotp(secretBase32: string, code: string, at = Date.now()) {
  if (!/^\d{6}$/.test(code)) return false;
  const secret = base32Decode(secretBase32);
  const step = Math.floor(at / 30000);
  return [-1, 0, 1].some((drift) =>
    timingSafeEqual(Buffer.from(hotp(secret, step + drift)), Buffer.from(code)),
  );
}
export const newTotpSecret = () => base32Encode(randomBytes(20));
export const otpauthUrl = (secret: string, account: string) =>
  `otpauth://totp/${encodeURIComponent(`Ayojon:${account}`)}?secret=${secret}&issuer=Ayojon&algorithm=SHA1&digits=6&period=30`;

/** TOTP secrets are encrypted at rest with AES-256-GCM. */
function key() {
  const material = process.env.TOTP_ENCRYPTION_KEY || process.env.JWT_SECRET || "";
  return createHash("sha256").update(`totp:${material}`).digest();
}
export function sealSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${data.toString("base64url")}`;
}
export function openSecret(sealed: string) {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1") throw new Error("Unknown secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
