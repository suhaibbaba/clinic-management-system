import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

export interface Sealed {
  readonly ciphertext: string;
  readonly iv: string;
  readonly authTag: string;
}

/** A value that cannot be read: a tampered row, a row moved between clinics, or a new master key. */
export class SecretUnreadableError extends Error {
  constructor() {
    super("A stored secret could not be decrypted");
    this.name = "SecretUnreadableError";
  }
}

// `context` is authenticated but not encrypted — the clinic and kind the value belongs to, so a
// ciphertext is only ever valid in the row it was written for.
export function seal(masterKey: Buffer, plaintext: string, context: string): Sealed {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, masterKey, iv);

  cipher.setAAD(Buffer.from(context, "utf8"));

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function open(masterKey: Buffer, sealed: Sealed, context: string): string {
  try {
    const decipher = createDecipheriv(ALGORITHM, masterKey, Buffer.from(sealed.iv, "base64"));

    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(Buffer.from(sealed.authTag, "base64"));

    return Buffer.concat([
      decipher.update(Buffer.from(sealed.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new SecretUnreadableError();
  }
}
