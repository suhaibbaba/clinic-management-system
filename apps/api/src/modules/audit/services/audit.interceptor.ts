import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AUDIT_ACTION } from "@clinic/shared";
import { concatMap, from, type Observable } from "rxjs";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { AuditService } from "@api/modules/audit/services/audit.service";
import { AUDIT_KEY, type AuditMetadata } from "@api/common/decorators/audit.decorator";
import { type RequestWithUser } from "@api/common/types/authenticated-user";
import { resolveEntityId, snapshot, extractId } from "@api/modules/audit/lib/audit.interceptor";

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
    const knownEntityId = resolveEntityId(metadata, actor, request.params);

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
