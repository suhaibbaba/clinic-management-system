import { USER_ROLE, USER_ROLES, type UserRole } from "@clinic/shared";

const DOCTORS_SCREEN_ROLES: readonly UserRole[] = [USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR];

export function assignableRoles(current: UserRole | undefined): readonly UserRole[] {
  return USER_ROLES.filter((role) => !DOCTORS_SCREEN_ROLES.includes(role) || role === current);
}
