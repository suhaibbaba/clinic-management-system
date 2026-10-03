import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { USER_ROLE, type UserRole } from "@clinic/shared";
import { ROLES_KEY } from "@api/common/decorators/roles.decorator";
import { OR_SELF_KEY } from "@api/common/decorators/or-self.decorator";
import { CapabilityRegistry } from "@api/modules/permissions/services/capability-registry.service";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";
import type { RequestWithUser } from "@api/common/types/authenticated-user";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly registry: CapabilityRegistry,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const { user, params } = context.switchToHttp().getRequest<RequestWithUser>();

    if (!required || required.length === 0) {
      return true;
    }

    if (!user) {
      throw new ForbiddenException("Insufficient role");
    }

    if (user.role === USER_ROLE.ADMIN) {
      return true;
    }

    const selfParam = this.reflector.get<string | undefined>(OR_SELF_KEY, context.getHandler());

    if (selfParam && params?.[selfParam] === user.id) {
      return true;
    }

    const capability = this.registry.keyFor(context.getHandler(), context.getClass());

    if (await this.permissions.allows(user.clinicId, user.role, capability)) {
      return true;
    }

    throw new ForbiddenException("Insufficient role");
  }
}
