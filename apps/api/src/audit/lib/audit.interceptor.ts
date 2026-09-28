import { type AuditMetadata } from "@api/common/decorators/audit.decorator";
import { type AuditSnapshotLoader } from "@api/audit/lib/audit-snapshot.registry";

export function resolveEntityId(
  metadata: AuditMetadata,
  actor: { clinicId: string; id: string },
  params: Record<string, string> | undefined,
): string | undefined {
  switch (metadata.entityIdSource) {
    case "clinic":
      return actor.clinicId;
    case "actor":
      return actor.id;
    case "patient":
      return params?.["patientId"];
    case "response":
      return undefined;
    default:
      return params?.["id"];
  }
}

export async function snapshot(
  loader: AuditSnapshotLoader | undefined,
  id: string | undefined,
  clinicId: string,
): Promise<Record<string, unknown> | null> {
  if (!loader || !id) {
    return null;
  }

  return loader(id, clinicId);
}

export function extractId(result: unknown): string | undefined {
  return idOf(result) ?? idOf((result as { item?: unknown } | null)?.item);
}

export function idOf(value: unknown): string | undefined {
  if (value && typeof value === "object" && "id" in value) {
    const { id } = value as { id: unknown };
    return typeof id === "string" ? id : undefined;
  }

  return undefined;
}
