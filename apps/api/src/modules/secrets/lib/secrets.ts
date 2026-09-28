import { clinicSecrets } from "@api/database/schema";
import { type ClinicSecretKind } from "@clinic/shared";

export type SecretRow = typeof clinicSecrets.$inferSelect;

export const context = (clinicId: string, kind: ClinicSecretKind): string => `${clinicId}:${kind}`;

export const described = (row: SecretRow): { kind: ClinicSecretKind; hint: string } => ({
  kind: row.kind,
  hint: row.hint,
});
