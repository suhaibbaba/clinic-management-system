import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@clinic/shared';

export const ROLES_KEY = 'roles';

/** `admin` always passes within its own clinic, so it never needs listing (ROLES.md). */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
