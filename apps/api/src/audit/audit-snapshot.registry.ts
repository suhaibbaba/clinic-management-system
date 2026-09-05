import { Injectable } from '@nestjs/common';

/**
 * Reads the current state of one row for the audit trail. Must return a
 * redacted projection — never a password hash or any other secret, because the
 * value is stored verbatim in `audit_log` and read back by admins.
 *
 * Returns null when the row does not exist (or is soft-deleted).
 */
export type AuditSnapshotLoader = (
  id: string,
  clinicId: string,
) => Promise<Record<string, unknown> | null>;

/**
 * Maps an entity name to its snapshot loader. Each domain module registers its
 * own, which keeps the interceptor generic and free of domain imports.
 */
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
