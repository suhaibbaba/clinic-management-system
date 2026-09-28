import { type PersonName } from "@clinic/shared";
import { createHash } from "node:crypto";

export type AccountEmailPurpose = "activate" | "reset";

export interface AccountEmailRecipient {
  readonly email: string;
  readonly name: PersonName;
}

export interface ClinicLetterhead {
  readonly name: PersonName;
  readonly logoKey: string | null;
  readonly email: string | null;
}

export interface IssuedToken {
  readonly token: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
