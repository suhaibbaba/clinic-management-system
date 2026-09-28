import { Injectable } from "@nestjs/common";
import { AuditSnapshotLoader } from "@api/audit/lib/audit-snapshot.registry";

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
