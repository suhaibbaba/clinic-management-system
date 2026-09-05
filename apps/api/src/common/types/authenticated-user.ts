import type { UserRole } from '@clinic/shared';

/**
 * The caller, resolved from a verified access token by `JwtAuthGuard` and
 * attached to the request. `clinicId` here is the only source of clinic scope —
 * it is never read from a request body, path or query (ROLES.md global rule 1).
 */
export interface AuthenticatedUser {
  readonly id: string;
  readonly clinicId: string;
  readonly role: UserRole;
}

/** Claims carried by an access token. */
export interface AccessTokenPayload {
  /** User id. */
  readonly sub: string;
  readonly clinicId: string;
  readonly role: UserRole;
}

/** Fastify request augmented with the authenticated caller. */
export interface RequestWithUser {
  user?: AuthenticatedUser;
  params?: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
}
