import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import {
  USER_ROLE,
  type ClinicNote,
  type CreateClinicNoteInput,
  type ListClinicNotesQuery,
  type Paginated,
  type UpdateClinicNoteInput,
} from '@clinic/shared';
import { desc, eq, sql } from 'drizzle-orm';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { clinicNotes, users } from '@api/database/schema';

export const CLINIC_NOTES_ENTITY = 'clinic_notes';

type NoteRow = typeof clinicNotes.$inferSelect;
type AuthorRow = { nameAr: string; nameEn: string; role: ClinicNote['authorRole'] } | null;

// A shared line at the front desk, so every signed-in role reads and writes it. Editing is the
// author's own; an admin can take any note down, because somebody has to be able to.
@Injectable()
export class NotesService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(CLINIC_NOTES_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(clinicNotes)
        .where(this.scope.where(clinicNotes, clinicId, eq(clinicNotes.id, id)))
        .limit(1);

      return row ? { body: row.body, authorId: row.authorId } : null;
    });
  }

  async list(
    actor: AuthenticatedUser,
    query: ListClinicNotesQuery,
  ): Promise<Paginated<ClinicNote>> {
    const where = this.scope.where(clinicNotes, actor.clinicId);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select({
          note: clinicNotes,
          author: { nameAr: users.nameAr, nameEn: users.nameEn, role: users.role },
        })
        .from(clinicNotes)
        .leftJoin(users, eq(users.id, clinicNotes.authorId))
        .where(where)
        .orderBy(desc(clinicNotes.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(clinicNotes)
        .where(where),
    ]);

    return toPaginated(
      rows.map((row) => toClinicNote(row.note, row.author)),
      totals?.value ?? 0,
      query,
    );
  }

  async create(actor: AuthenticatedUser, input: CreateClinicNoteInput): Promise<ClinicNote> {
    const [row] = await this.db
      .insert(clinicNotes)
      .values({
        clinicId: actor.clinicId,
        body: input.body,
        authorId: actor.id,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    return this.readOne(actor, row!.id);
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateClinicNoteInput,
  ): Promise<ClinicNote> {
    const existing = await this.scope.findOneOrFail<NoteRow>(clinicNotes, actor.clinicId, id);
    this.requireOwnership(actor, existing);

    const [row] = await this.db
      .update(clinicNotes)
      .set({ body: input.body, updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(clinicNotes, actor.clinicId, eq(clinicNotes.id, id)))
      .returning();

    return this.readOne(actor, row!.id);
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    const existing = await this.scope.findOneOrFail<NoteRow>(clinicNotes, actor.clinicId, id);
    this.requireOwnership(actor, existing);

    await this.db
      .update(clinicNotes)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(clinicNotes, actor.clinicId, eq(clinicNotes.id, id)));
  }

  private requireOwnership(actor: AuthenticatedUser, note: NoteRow): void {
    if (actor.role !== USER_ROLE.ADMIN && note.authorId !== actor.id) {
      throw new ForbiddenException('A note may only be changed by the person who wrote it');
    }
  }

  /** Read back through the same join the list uses, so one write and one read never disagree. */
  private async readOne(actor: AuthenticatedUser, id: string): Promise<ClinicNote> {
    const [row] = await this.db
      .select({
        note: clinicNotes,
        author: { nameAr: users.nameAr, nameEn: users.nameEn, role: users.role },
      })
      .from(clinicNotes)
      .leftJoin(users, eq(users.id, clinicNotes.authorId))
      .where(this.scope.where(clinicNotes, actor.clinicId, eq(clinicNotes.id, id)))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Note not found');
    }

    return toClinicNote(row.note, row.author);
  }
}

function toClinicNote(row: NoteRow, author: AuthorRow): ClinicNote {
  return {
    id: row.id,
    clinicId: row.clinicId,
    body: row.body,
    authorId: row.authorId,
    authorName: author ? { ar: author.nameAr, en: author.nameEn } : null,
    authorRole: author?.role ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
