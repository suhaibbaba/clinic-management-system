import { clinicSecrets } from "@api/database/schema";
import { type StoredSecretKind } from "@clinic/shared";

export type SecretRow = typeof clinicSecrets.$inferSelect;

export const context = (clinicId: string, kind: StoredSecretKind): string => `${clinicId}:${kind}`;

export const described = (row: SecretRow): { kind: StoredSecretKind; hint: string } => ({
  kind: row.kind,
  hint: row.hint,
});
