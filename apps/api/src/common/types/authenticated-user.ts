import type { UserRole } from "@clinic/shared";

export interface AuthenticatedUser {
  readonly id: string;
  readonly clinicId: string;
  readonly role: UserRole;
}

export interface AccessTokenPayload {
  readonly sub: string;
  readonly clinicId: string;
  readonly role: UserRole;
}

export interface RequestWithUser {
  user?: AuthenticatedUser;
  params?: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
}
