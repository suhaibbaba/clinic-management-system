import { z } from "zod";
import { CHART_TYPES, USER_ROLES } from "@shared/enums";
import { personNameSchema } from "@shared/schemas/person-name";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;

export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(255),
  password: passwordSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(512).optional(),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const logoutSchema = refreshSchema;
export type LogoutInput = z.infer<typeof logoutSchema>;

export const setPasswordSchema = z.object({
  token: z.string().min(16).max(256),
  password: passwordSchema,
});
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(3).max(255),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const LOGIN_CODE_LENGTH = 6;

export const loginCodeEmailSchema = z.string().trim().toLowerCase().max(255).pipe(z.email());

export const requestLoginCodeSchema = z.object({
  email: loginCodeEmailSchema,
});
export type RequestLoginCodeInput = z.infer<typeof requestLoginCodeSchema>;

export const verifyLoginCodeSchema = z.object({
  email: loginCodeEmailSchema,
  code: z.string().trim().length(LOGIN_CODE_LENGTH).regex(/^\d+$/),
});
export type VerifyLoginCodeInput = z.infer<typeof verifyLoginCodeSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: passwordSchema,
    newPassword: passwordSchema,
  })
  .refine((input) => input.currentPassword !== input.newPassword, {
    message: "New password must differ from the current one",
    path: ["newPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const sessionClinicSchema = z.object({
  name: personNameSchema,
  logoUrl: z.url().nullable(),
  chartTypes: z.array(z.enum(CHART_TYPES)),
  country: z.string(),
});
export type SessionClinic = z.infer<typeof sessionClinicSchema>;

export const authenticatedUserSchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  clinic: sessionClinicSchema,
  name: personNameSchema,
  firstName: personNameSchema,
  lastName: personNameSchema,
  phone: z.string(),
  email: z.string().nullable(),
  role: z.enum(USER_ROLES),
  isActive: z.boolean(),
  photoUrl: z.url().nullable(),
  capabilities: z.array(z.string()),
});
export type AuthenticatedUserProfile = z.infer<typeof authenticatedUserSchema>;

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
