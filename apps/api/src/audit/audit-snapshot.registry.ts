import { Injectable } from '@nestjs/common';

// Must return a redacted projection — never a password hash: the value is stored verbatim in
// `audit_log` and read back by admins.
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
