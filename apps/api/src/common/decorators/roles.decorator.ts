import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@clinic/shared';

export const ROLES_KEY = 'roles';

/**
 * Restricts an endpoint to the listed roles. `admin` always passes within its
 * own clinic, so it never needs to be listed (ROLES.md).
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
