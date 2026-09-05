import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { USER_ROLE, type UserRole } from '@clinic/shared';

import { ROLES_KEY } from '@api/common/decorators/roles.decorator';
import type { RequestWithUser } from '@api/common/types/authenticated-user';

/**
 * Role check for endpoints carrying `@Roles(...)` (ROLES.md enforcement step 2).
 * Runs after `JwtAuthGuard`, so a caller is always present.
 *
 * `admin` implicitly passes every role check within their clinic; cross-clinic
 * access is impossible for any role because scoping happens on every query.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();

    if (!user) {
      // A @Roles() endpoint that is also @Public() is a wiring mistake.
      throw new ForbiddenException('Insufficient role');
    }

    if (user.role === USER_ROLE.ADMIN || required.includes(user.role)) {
      return true;
    }

    throw new ForbiddenException('Insufficient role');
  }
}
