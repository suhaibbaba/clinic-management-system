import { SetMetadata } from '@nestjs/common';
import type { AuditAction } from '@clinic/shared';

export const AUDIT_KEY = 'audit';

// `route`: the `:id` param, falling back to the response's `id`, which covers creates. `clinic`:
// singleton routes. `patient`: `:patientId`. `response`: when `:id` names a different entity.
export type AuditEntityIdSource = 'route' | 'clinic' | 'patient' | 'response';

export interface AuditMetadata {
  readonly entity: string;
  readonly action: AuditAction;
  readonly entityIdSource: AuditEntityIdSource;
}

// The interceptor snapshots the row before and after the handler, so the entity needs a loader in
// `AuditSnapshotRegistry`.
export const Audit = (
  entity: string,
  action: AuditAction,
  options: { entityIdSource?: AuditEntityIdSource } = {},
): MethodDecorator =>
  SetMetadata(AUDIT_KEY, {
    entity,
    action,
    entityIdSource: options.entityIdSource ?? 'route',
  } satisfies AuditMetadata);
