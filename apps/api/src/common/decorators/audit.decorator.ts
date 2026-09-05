import { SetMetadata } from '@nestjs/common';
import type { AuditAction } from '@clinic/shared';

export const AUDIT_KEY = 'audit';

/**
 * Where the interceptor finds the id of the affected row.
 *  - `route`    the `:id` route parameter (the default), falling back to the
 *               `id` of the response body, which is how creates are covered
 *  - `clinic`   the caller's own clinic, for singleton routes such as
 *               `PATCH /clinic` that carry no id at all
 *  - `patient`  the `:patientId` route parameter, for rows that are a
 *               singleton per patient such as the medical history
 *  - `response` the `id` of the response body only, for routes whose `:id`
 *               names a different entity than the one being written — e.g.
 *               `POST /plan-items/:id/convert`, which creates a performed
 *               procedure
 */
export type AuditEntityIdSource = 'route' | 'clinic' | 'patient' | 'response';

export interface AuditMetadata {
  /** Table name of the affected row, e.g. `users`. */
  readonly entity: string;
  readonly action: AuditAction;
  readonly entityIdSource: AuditEntityIdSource;
}

/**
 * Marks a mutation endpoint for the `AuditInterceptor`
 * (CLAUDE.md architecture decision 4, ROLES.md enforcement step 6).
 *
 * The interceptor snapshots the row before and after the handler, so the entity
 * needs a loader registered with `AuditSnapshotRegistry`.
 */
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
