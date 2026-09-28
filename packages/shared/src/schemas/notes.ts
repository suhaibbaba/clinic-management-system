import { z } from "zod";
import { paginationQuerySchema, uuidSchema } from "@shared/schemas/common";
import { personNameSchema } from "@shared/schemas/person-name";
import { USER_ROLES } from "@shared/enums";

export const clinicNoteSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  body: z.string(),
  authorId: uuidSchema.nullable(),
  authorName: personNameSchema.nullable(),
  authorRole: z.enum(USER_ROLES).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ClinicNote = z.infer<typeof clinicNoteSchema>;

const noteBody = z.string().trim().min(2).max(500);

export const createClinicNoteSchema = z.object({ body: noteBody });
export type CreateClinicNoteInput = z.infer<typeof createClinicNoteSchema>;

export const updateClinicNoteSchema = z.object({ body: noteBody });
export type UpdateClinicNoteInput = z.infer<typeof updateClinicNoteSchema>;

export const listClinicNotesQuerySchema = paginationQuerySchema;
export type ListClinicNotesQuery = z.infer<typeof listClinicNotesQuerySchema>;
