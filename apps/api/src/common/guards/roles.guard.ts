import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CLINIC_ERROR, USER_ROLE, type ClinicModule, type UserRole } from "@clinic/shared";
import { ROLES_KEY } from "@api/common/decorators/roles.decorator";
import { OR_SELF_KEY } from "@api/common/decorators/or-self.decorator";
import { CLINIC_FEATURE_KEY } from "@api/common/decorators/clinic-feature.decorator";
import { CapabilityRegistry } from "@api/modules/permissions/services/capability-registry.service";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";
import type { RequestWithUser } from "@api/common/types/authenticated-user";
import { READ_METHODS } from "@api/common/constants/http";

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

    const { user, params, method } = context
      .switchToHttp()
      .getRequest<RequestWithUser & { method?: string }>();

    if (
      user &&
      !READ_METHODS.has(method ?? "GET") &&
      (await this.permissions.readOnly(user.clinicId))
    ) {
      throw new ForbiddenException(CLINIC_ERROR.SUSPENDED);
    }

    const feature = this.reflector.getAllAndOverride<ClinicModule | undefined>(CLINIC_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (feature && user && !(await this.permissions.moduleEnabled(user.clinicId, feature))) {
      throw new ForbiddenException("This module is not enabled for the clinic");
    }

    if (!required || required.length === 0) {
      return true;
    }

    if (!user) {
      throw new ForbiddenException("Insufficient role");
    }

    const capability = this.registry.keyFor(context.getHandler(), context.getClass());

    if (!(await this.permissions.available(user.clinicId, capability))) {
      throw new ForbiddenException("This module is not enabled for the clinic");
    }

    if (user.role === USER_ROLE.ADMIN) {
      return true;
    }

    const selfParam = this.reflector.get<string | undefined>(OR_SELF_KEY, context.getHandler());

    if (selfParam && params?.[selfParam] === user.id) {
      return true;
    }

    if (await this.permissions.allows(user.clinicId, user.role, capability)) {
      return true;
    }

    throw new ForbiddenException("Insufficient role");
  }
}
