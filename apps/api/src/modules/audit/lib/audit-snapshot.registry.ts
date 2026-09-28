export type AuditSnapshotLoader = (
  id: string,
  clinicId: string,
) => Promise<Record<string, unknown> | null>;
