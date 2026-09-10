import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUDIT_ACTION } from '@clinic/shared';
import { concatMap, from, type Observable } from 'rxjs';

import {
  AuditSnapshotRegistry,
  type AuditSnapshotLoader,
} from '@api/audit/audit-snapshot.registry';
import { AuditService } from '@api/audit/audit.service';
import { AUDIT_KEY, type AuditMetadata } from '@api/common/decorators/audit.decorator';
import type { RequestWithUser } from '@api/common/types/authenticated-user';

// Inert without the `@Audit(...)` decorator. The entry is written only after the handler succeeds,
// and failing to write it fails the request — an unaudited mutation must never look successful.
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly registry: AuditSnapshotRegistry,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.getAllAndOverride<AuditMetadata | undefined>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const actor = request.user;

    if (!actor) {
      return next.handle();
    }

    const loader = this.registry.get(metadata.entity);
    const knownEntityId = resolveEntityId(metadata, actor.clinicId, request.params);

    // Snapshot before the handler runs: for an update or a soft delete this is
    // the only moment the previous state is still readable.
    return from(snapshot(loader, knownEntityId, actor.clinicId)).pipe(
      concatMap((oldValue) =>
        next.handle().pipe(
          concatMap(async (result: unknown) => {
            const entityId = knownEntityId ?? extractId(result);

            if (entityId) {
              const newValue =
                metadata.action === AUDIT_ACTION.DELETE
                  ? null
                  : await snapshot(loader, entityId, actor.clinicId);

              await this.auditService.record({
                clinicId: actor.clinicId,
                userId: actor.id,
                action: metadata.action,
                entity: metadata.entity,
                entityId,
                oldValue,
                newValue,
              });
            }

            return result;
          }),
        ),
      ),
    );
  }
}

// `response` yields nothing: such a route always creates a row, so the id comes from the result and
// there is no previous state to snapshot.
function resolveEntityId(
  metadata: AuditMetadata,
  clinicId: string,
  params: Record<string, string> | undefined,
): string | undefined {
  switch (metadata.entityIdSource) {
    case 'clinic':
      return clinicId;
    case 'patient':
      return params?.['patientId'];
    case 'response':
      return undefined;
    default:
      return params?.['id'];
  }
}

async function snapshot(
  loader: AuditSnapshotLoader | undefined,
  id: string | undefined,
  clinicId: string,
): Promise<Record<string, unknown> | null> {
  if (!loader || !id) {
    return null;
  }

  return loader(id, clinicId);
}

// A create has no `:id` param, so the id comes from the response, or from `{ item, ... }` one level
// in. Only those two shapes — walking an arbitrary response puts the wrong row in the trail.
function extractId(result: unknown): string | undefined {
  return idOf(result) ?? idOf((result as { item?: unknown } | null)?.item);
}

function idOf(value: unknown): string | undefined {
  if (value && typeof value === 'object' && 'id' in value) {
    const { id } = value as { id: unknown };
    return typeof id === 'string' ? id : undefined;
  }

  return undefined;
}
