import { z } from 'zod';

import { USER_ROLES } from '@shared/enums';

/** Minimum password length accepted anywhere in the system. */
export const PASSWORD_MIN_LENGTH = 8;
/** Upper bound so a huge body can never turn into an expensive hash. */
export const PASSWORD_MAX_LENGTH = 200;

export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

/**
 * Login accepts either the phone number or the email in one field — the API
 * decides which by matching, so the UI needs a single input.
 */
export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(255),
  password: passwordSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(512),
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

/** The caller's own profile — never includes the password hash. */
export const authenticatedUserSchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  role: z.enum(USER_ROLES),
  isActive: z.boolean(),
});
export type AuthenticatedUserProfile = z.infer<typeof authenticatedUserSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** Access-token lifetime in seconds. */
  expiresIn: z.number().int().positive(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const loginResponseSchema = authTokensSchema.extend({
  user: authenticatedUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;
