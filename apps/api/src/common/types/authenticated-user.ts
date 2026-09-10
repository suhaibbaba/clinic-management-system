import type { UserRole } from '@clinic/shared';

// `clinicId` here is the only source of clinic scope — never read from a body, path or query
// (ROLES.md global rule 1).
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
