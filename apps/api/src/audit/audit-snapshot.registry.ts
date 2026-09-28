import { Injectable } from "@nestjs/common";

export type AuditSnapshotLoader = (
  id: string,
  clinicId: string,
) => Promise<Record<string, unknown> | null>;

@Injectable()
export class AuditSnapshotRegistry {
  private readonly loaders = new Map<string, AuditSnapshotLoader>();

  register(entity: string, loader: AuditSnapshotLoader): void {
    this.loaders.set(entity, loader);
  }

  get(entity: string): AuditSnapshotLoader | undefined {
    return this.loaders.get(entity);
  }
}
