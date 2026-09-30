import { z } from "zod";
import { USER_ROLES } from "@shared/enums";
import { passwordSchema } from "@shared/schemas/auth";
import {
  calendarDateSchema,
  paginationQuerySchema,
  pastDateSchema,
  phoneSchema,
} from "@shared/schemas/common";
import { personNameSchema, staffNameInputFields } from "@shared/schemas/person-name";

export const userSchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  name: personNameSchema,
  firstName: personNameSchema,
  lastName: personNameSchema,
  phone: z.string(),
  email: z.string().nullable(),
  activated: z.boolean(),
  role: z.enum(USER_ROLES),
  isActive: z.boolean(),
  joinedOn: calendarDateSchema.nullable(),
  photoUrl: z.url().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type User = z.infer<typeof userSchema>;

const userWritableFields = {
  ...staffNameInputFields,
  phone: phoneSchema,
  email: z.email().max(255).nullish(),
  role: z.enum(USER_ROLES),
  isActive: z.boolean(),
  joinedOn: pastDateSchema,
};

export const createUserSchema = z
  .object({
    ...userWritableFields,
    password: passwordSchema.optional(),
    isActive: z.boolean().default(true),
  })
  .refine((input) => Boolean(input.email) || Boolean(input.password), {
    message: "Give an email address to invite by, or a password to set directly",
    path: ["email"],
  });
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object(userWritableFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field must be provided");
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const updateOwnProfileSchema = z
  .object({
    ...staffNameInputFields,
    phone: phoneSchema,
    email: z.email().max(255).nullish(),
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field must be provided");
export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;

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

export const MAX_USER_PHOTO_BYTES = 2 * 1024 * 1024;

export const ALLOWED_USER_PHOTO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

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

export const confirmUserPhotoSchema = z.object({
  key: z.string().trim().min(1).max(512),
});
export type ConfirmUserPhotoInput = z.infer<typeof confirmUserPhotoSchema>;
