import { type Passkey } from "@clinic/shared";
import { passkeys } from "@api/database/schema";

export type PasskeyRow = typeof passkeys.$inferSelect;

export interface RelyingParty {
  readonly id: string;
  readonly origins: string[];
}

export function relyingParty(
  publicBaseUrl: string,
  rpId: string | undefined,
  origins: string[] | undefined,
): RelyingParty {
  const base = new URL(publicBaseUrl);

  return {
    id: rpId ?? base.hostname,
    origins: origins && origins.length > 0 ? origins : [base.origin],
  };
}

export function toPasskey(row: PasskeyRow): Passkey {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  };
}
