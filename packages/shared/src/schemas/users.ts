import { z } from 'zod';

import { USER_ROLES } from '@shared/enums';
import { passwordSchema } from '@shared/schemas/auth';
import { paginationQuerySchema } from '@shared/schemas/common';

/**
 * Loose on purpose: clinics operate in regions with varied local formats, so
 * the API stores what reception types and only enforces shape, not country.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(6)
  .max(32)
  .regex(/^\+?[0-9\s-]+$/, 'Expected digits, optionally prefixed with +');

export const userSchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  role: z.enum(USER_ROLES),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type User = z.infer<typeof userSchema>;

/**
 * Writable fields, declared once and without defaults. `createUserSchema` adds
 * the defaults; `updateUserSchema` must not have any — a default survives
 * `.partial()` and would silently rewrite a field the caller never sent.
 *
 * `clinicId` is deliberately absent: it comes from the caller's token, never
 * from the request body (ROLES.md global rule 1).
 */
const userWritableFields = {
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  email: z.email().max(255).nullish(),
  role: z.enum(USER_ROLES),
  isActive: z.boolean(),
};

export const createUserSchema = z.object({
  ...userWritableFields,
  password: passwordSchema,
  isActive: z.boolean().default(true),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object(userWritableFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * Admin resetting another user's password. Separate from `changePasswordSchema`
 * because an admin does not know the current one.
 */
export const resetUserPasswordSchema = z.object({
  newPassword: passwordSchema,
});
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;

export const listUsersQuerySchema = paginationQuerySchema.extend({
  role: z.enum(USER_ROLES).optional(),
  isActive: z.stringbool().optional(),
  /** Matches name, phone or email. */
  search: z.string().trim().min(1).max(120).optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
