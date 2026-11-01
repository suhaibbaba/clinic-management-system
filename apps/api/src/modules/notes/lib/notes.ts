import { clinicNotes } from "@api/database/schema";
import { type ClinicNote, type PersonName } from "@clinic/shared";

export type NoteRow = typeof clinicNotes.$inferSelect;

export type AuthorRow = { name: PersonName; role: ClinicNote["authorRole"] } | null;

export function toClinicNote(row: NoteRow, author: AuthorRow): ClinicNote {
  return {
    id: row.id,
    clinicId: row.clinicId,
    body: row.body,
    authorId: row.authorId,
    authorName: author?.name ?? null,
    authorRole: author?.role ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
