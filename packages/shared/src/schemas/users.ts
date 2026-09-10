import { z } from 'zod';

import { USER_ROLES } from '@shared/enums';
import { passwordSchema } from '@shared/schemas/auth';
import { paginationQuerySchema } from '@shared/schemas/common';
import { personNameInputSchema, personNameSchema } from '@shared/schemas/person-name';

/** Loose on purpose: local formats vary by region, so the API enforces shape and not country. */
export const phoneSchema = z
  .string()
  .trim()
  .min(6)
  .max(32)
  .regex(/^\+?[0-9\s-]+$/, 'Expected digits, optionally prefixed with +');

export const userSchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  name: personNameSchema,
  phone: z.string(),
  email: z.string().nullable(),
  role: z.enum(USER_ROLES),
  isActive: z.boolean(),
  // Minted per response and expiring with the download TTL — the stored object key never leaves the
  // API, so this is not writable.
  photoUrl: z.url().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type User = z.infer<typeof userSchema>;

// No defaults: one survives `.partial()` in `updateUserSchema` and would rewrite a field nobody
// sent. `clinicId` comes from the caller's token, never the body.
const userWritableFields = {
  name: personNameInputSchema,
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

export const resetUserPasswordSchema = z.object({
  newPassword: passwordSchema,
});
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;

export const listUsersQuerySchema = paginationQuerySchema.extend({
  role: z.enum(USER_ROLES).optional(),
  isActive: z.stringbool().optional(),
  search: z.string().trim().min(1).max(120).optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

// Presign, PUT, confirm — as the logo does, so no image travels through the API and size and type
// are read back from what landed.
export const MAX_USER_PHOTO_BYTES = 2 * 1024 * 1024;

export const ALLOWED_USER_PHOTO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export const userPhotoMimeSchema = z.enum(ALLOWED_USER_PHOTO_MIME_TYPES);
export type UserPhotoMime = z.infer<typeof userPhotoMimeSchema>;

export const presignUserPhotoSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mime: userPhotoMimeSchema,
  sizeBytes: z.number().int().positive().max(MAX_USER_PHOTO_BYTES),
});
export type PresignUserPhotoInput = z.infer<typeof presignUserPhotoSchema>;

export const presignUserPhotoResponseSchema = z.object({
  key: z.string(),
  uploadUrl: z.url(),
  expiresAt: z.iso.datetime(),
  maxSizeBytes: z.number().int().positive(),
});
export type PresignUserPhotoResponse = z.infer<typeof presignUserPhotoResponseSchema>;

/** Called once the client has PUT the object; the API reads the bytes back. */
export const confirmUserPhotoSchema = z.object({
  key: z.string().trim().min(1).max(512),
});
export type ConfirmUserPhotoInput = z.infer<typeof confirmUserPhotoSchema>;
