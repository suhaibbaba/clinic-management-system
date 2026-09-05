import { BadRequestException, Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type {
  CreateVisitInput,
  ListVisitsQuery,
  Paginated,
  UpdateVisitInput,
  Visit,
} from '@clinic/shared';
import { desc, eq, sql, type SQL } from 'drizzle-orm';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { doctors, visits } from '@api/database/schema';
import { PatientAccessService } from '@api/patients/patient-access.service';

type VisitRow = typeof visits.$inferSelect;

export const VISITS_ENTITY = 'visits';

/** Visits are clinical: admin and doctor only (ROLES.md patients matrix). */
@Injectable()
export class VisitsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly patientAccess: PatientAccessService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(VISITS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(visits)
        .where(this.scope.where(visits, clinicId, eq(visits.id, id)))
        .limit(1);

      return row ? { ...toVisit(row) } : null;
    });
  }

  async list(actor: AuthenticatedUser, query: ListVisitsQuery): Promise<Paginated<Visit>> {
    const filters: (SQL | undefined)[] = [];

    if (query.patientId) {
      await this.patientAccess.requirePatientId(actor, query.patientId);
      filters.push(eq(visits.patientId, query.patientId));
    }
    if (query.doctorId) {
      filters.push(eq(visits.doctorId, query.doctorId));
    }

    const where = this.scope.where(visits, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(visits)
        .where(where)
        .orderBy(desc(visits.visitDate))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(visits)
        .where(where),
    ]);

    return toPaginated(rows.map(toVisit), totals?.value ?? 0, query);
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<Visit> {
    return toVisit(await this.scope.findOneOrFail<VisitRow>(visits, actor.clinicId, id));
  }

  async create(actor: AuthenticatedUser, input: CreateVisitInput): Promise<Visit> {
    await this.patientAccess.requirePatientId(actor, input.patientId);
    await this.requireDoctor(actor, input.doctorId);

    const [row] = await this.db
      .insert(visits)
      .values({
        clinicId: actor.clinicId,
        patientId: input.patientId,
        doctorId: input.doctorId,
        visitDate: input.visitDate ? new Date(input.visitDate) : new Date(),
        complaint: input.complaint ?? null,
        examination: input.examination ?? null,
        diagnosis: input.diagnosis ?? null,
        notes: input.notes ?? null,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!row) {
      throw new Error('Failed to create visit');
    }

    return toVisit(row);
  }

  async update(actor: AuthenticatedUser, id: string, input: UpdateVisitInput): Promise<Visit> {
    await this.scope.findOneOrFail<VisitRow>(visits, actor.clinicId, id);

    if (input.doctorId) {
      await this.requireDoctor(actor, input.doctorId);
    }

    const [row] = await this.db
      .update(visits)
      .set({
        ...(input.doctorId !== undefined && { doctorId: input.doctorId }),
        ...(input.visitDate !== undefined && { visitDate: new Date(input.visitDate) }),
        ...(input.complaint !== undefined && { complaint: input.complaint ?? null }),
        ...(input.examination !== undefined && { examination: input.examination ?? null }),
        ...(input.diagnosis !== undefined && { diagnosis: input.diagnosis ?? null }),
        ...(input.notes !== undefined && { notes: input.notes ?? null }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(visits, actor.clinicId, eq(visits.id, id)))
      .returning();

    /* istanbul ignore next -- the row was just loaded. */
    if (!row) {
      throw new Error('Failed to update visit');
    }

    return toVisit(row);
  }

  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.scope.findOneOrFail<VisitRow>(visits, actor.clinicId, id);

    await this.db
      .update(visits)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(visits, actor.clinicId, eq(visits.id, id)));
  }

  /** A visit must reference a doctor in the same clinic. */
  private async requireDoctor(actor: AuthenticatedUser, doctorId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: doctors.id })
      .from(doctors)
      .where(this.scope.where(doctors, actor.clinicId, eq(doctors.id, doctorId)))
      .limit(1);

    if (!row) {
      throw new BadRequestException('Doctor not found in this clinic');
    }
  }
}

export function toVisit(row: VisitRow): Visit {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    doctorId: row.doctorId,
    visitDate: row.visitDate.toISOString(),
    complaint: row.complaint,
    examination: row.examination,
    diagnosis: row.diagnosis,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
