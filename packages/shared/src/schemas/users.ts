import { z } from 'zod';

import { USER_ROLES } from '@shared/enums';
import { passwordSchema } from '@shared/schemas/auth';
import { paginationQuerySchema } from '@shared/schemas/common';
import { personNameInputSchema, personNameSchema } from '@shared/schemas/person-name';

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
  /** Both spellings; screens pick one through `PersonName` (see the helper). */
  name: personNameSchema,
  phone: z.string(),
  email: z.string().nullable(),
  role: z.enum(USER_ROLES),
  isActive: z.boolean(),
  /**
   * A short-lived signed URL for the staff photo, or null when there is none.
   *
   * The stored object key never leaves the API (CLAUDE.md files & images), so
   * this is not a field a client may write — it is minted per response and
   * expires with the download TTL, and `<Avatar>` falls back to initials both
   * when it is null and when the URL has gone stale in an open tab.
   */
  photoUrl: z.url().nullable(),
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
  /** Matches either spelling of the name, the phone or the email. */
  search: z.string().trim().min(1).max(120).optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

/**
 * A staff photo: a face in a circle beside a name, on the users list, the
 * doctors list and the calendar's own columns.
 *
 * Uploaded exactly the way the clinic's logo is — presign, PUT straight to
 * storage, confirm — so no image ever travels through the API, and the size
 * and type are read back from what actually landed rather than trusted from
 * the request.
 *
 * 2 MB and the same three formats as the logo: this is drawn at 36 pixels and
 * at most a couple of hundred on a profile, so anything larger is a phone
 * camera's original being uploaded whole.
 */
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
  /** Opaque to the client; it is echoed back on confirm. */
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
