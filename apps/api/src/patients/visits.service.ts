import { BadRequestException, Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { AUDIT_ACTION } from "@clinic/shared";
import type {
  CreateVisitInput,
  ListVisitsQuery,
  Paginated,
  UpdateVisitInput,
  Visit,
} from "@clinic/shared";
import { desc, eq, sql, type SQL } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/audit/audit-snapshot.registry";
import { AuditService } from "@api/audit/audit.service";
import { ChargesService } from "@api/billing/charges.service";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { attachments, doctors, performedProcedures, visits } from "@api/database/schema";
import { ATTACHMENTS_ENTITY } from "@api/patients/attachments.service";
import { PatientAccessService } from "@api/patients/patient-access.service";
import { PERFORMED_PROCEDURES_ENTITY, ProceduresService } from "@api/patients/procedures.service";

type VisitRow = typeof visits.$inferSelect;

export const VISITS_ENTITY = "visits";

/** Visits are clinical: admin and doctor only (ROLES.md patients matrix). */
@Injectable()
export class VisitsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly patientAccess: PatientAccessService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
    private readonly audit: AuditService,
    private readonly charges: ChargesService,
    private readonly procedures: ProceduresService,
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
    const filters: (SQL | undefined)[] = [
      await this.patientAccess.assignedFilter(actor, visits.patientId),
    ];

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
    return toVisit(await this.patientAccess.requireRow<VisitRow>(actor, visits, id));
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

    if (!row) {
      throw new Error("Failed to create visit");
    }

    return toVisit(row);
  }

  async update(actor: AuthenticatedUser, id: string, input: UpdateVisitInput): Promise<Visit> {
    await this.patientAccess.requireRow<VisitRow>(actor, visits, id);

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

    if (!row) {
      throw new Error("Failed to update visit");
    }

    return toVisit(row);
  }

  // All or nothing: one procedure with money against it keeps the whole visit. What goes with the
  // visit is audited here, one entry each; the visit's own entry is the interceptor's.
  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    const visit = await this.patientAccess.requireRow<VisitRow>(actor, visits, id);
    const procedureIds = (
      await this.db
        .select({ id: performedProcedures.id })
        .from(performedProcedures)
        .where(
          this.scope.where(
            performedProcedures,
            actor.clinicId,
            eq(performedProcedures.visitId, id),
          ),
        )
    ).map((row) => row.id);
    const attachmentIds = (
      await this.db
        .select({ id: attachments.id })
        .from(attachments)
        .where(this.scope.where(attachments, actor.clinicId, eq(attachments.visitId, id)))
    ).map((row) => row.id);
    const dependants = [
      ...procedureIds.map((entityId) => ({ entity: PERFORMED_PROCEDURES_ENTITY, entityId })),
      ...attachmentIds.map((entityId) => ({ entity: ATTACHMENTS_ENTITY, entityId })),
    ];
    const before = await Promise.all(
      dependants.map(({ entity, entityId }) =>
        this.auditSnapshots.get(entity)?.(entityId, actor.clinicId),
      ),
    );

    await this.db.transaction(async (tx) => {
      await this.charges.assertRemovable(tx, actor.clinicId, visit.patientId, procedureIds);

      for (const procedureId of procedureIds) {
        await this.procedures.removeInTransaction(tx, actor, procedureId);
      }

      const now = new Date();
      await tx
        .update(attachments)
        .set({ deletedAt: now, updatedAt: now, updatedBy: actor.id })
        .where(this.scope.where(attachments, actor.clinicId, eq(attachments.visitId, id)));
      await tx
        .update(visits)
        .set({ deletedAt: now, updatedAt: now, updatedBy: actor.id })
        .where(this.scope.where(visits, actor.clinicId, eq(visits.id, id)));

      for (const [index, { entity, entityId }] of dependants.entries()) {
        await this.audit.record(
          {
            clinicId: actor.clinicId,
            userId: actor.id,
            action: AUDIT_ACTION.DELETE,
            entity,
            entityId,
            oldValue: before[index] ?? null,
            newValue: null,
          },
          tx,
        );
      }
    });
  }

  /** A visit must reference a doctor in the same clinic. */
  private async requireDoctor(actor: AuthenticatedUser, doctorId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: doctors.id })
      .from(doctors)
      .where(this.scope.where(doctors, actor.clinicId, eq(doctors.id, doctorId)))
      .limit(1);

    if (!row) {
      throw new BadRequestException("Doctor not found in this clinic");
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
