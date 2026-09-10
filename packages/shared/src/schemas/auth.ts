import { z } from 'zod';

import { USER_ROLES } from '@shared/enums';
import { personNameSchema } from '@shared/schemas/person-name';

export const PASSWORD_MIN_LENGTH = 8;
/** Upper bound so a huge body can never turn into an expensive hash. */
export const PASSWORD_MAX_LENGTH = 200;

export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

/** One field for phone or email — the API decides which by matching. */
export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(255),
  password: passwordSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

// Optional because browsers send it in the httpOnly cookie the API sets at login; other clients
// pass it here.
export const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(512).optional(),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const logoutSchema = refreshSchema;
export type LogoutInput = z.infer<typeof logoutSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: passwordSchema,
    newPassword: passwordSchema,
  })
  .refine((input) => input.currentPassword !== input.newPassword, {
    message: 'New password must differ from the current one',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Travels with the profile so the chrome — the rail's logo, the tab's title — is drawn on the
// first render rather than after a second round trip to `/clinic`.
export const sessionClinicSchema = z.object({
  name: personNameSchema,
  logoUrl: z.url().nullable(),
});
export type SessionClinic = z.infer<typeof sessionClinicSchema>;

/** The caller's own profile — never includes the password hash. */
export const authenticatedUserSchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  clinic: sessionClinicSchema,
  name: personNameSchema,
  phone: z.string(),
  email: z.string().nullable(),
  role: z.enum(USER_ROLES),
  isActive: z.boolean(),
  photoUrl: z.url().nullable(),
});
export type AuthenticatedUserProfile = z.infer<typeof authenticatedUserSchema>;

// The refresh token is deliberately absent — it is an httpOnly cookie, so an XSS on the web app
// cannot read it.
export const authTokensSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export interface IssuedSession extends AuthTokens {
  readonly refreshToken: string;
}

export const loginResponseSchema = authTokensSchema.extend({
  user: authenticatedUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;
