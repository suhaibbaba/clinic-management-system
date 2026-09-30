import { BadRequestException, Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import {
  AUDIT_ACTION,
  PERFORMED_PROCEDURE_STATUS,
  type CreateTreatmentPlanInput,
  type ListTreatmentPlansQuery,
  type Paginated,
  type TreatmentPlan,
  type UpdateTreatmentPlanInput,
} from "@clinic/shared";
import { desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { AuditService } from "@api/modules/audit/services/audit.service";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { doctors, performedProcedures, treatmentPlans } from "@api/database/schema";
import { PatientAccessService } from "@api/modules/patients/services/patient-access.service";
import {
  PERFORMED_PROCEDURES_ENTITY,
  TREATMENT_PLANS_ENTITY,
} from "@api/common/constants/audit-entities";
import {
  EMPTY_PLAN_SUMMARY,
  planSummaryColumns,
  toPlan,
  type PlanRow,
  type PlanSummaryRow,
} from "@api/modules/patients/lib/treatment-plans";

@Injectable()
export class TreatmentPlansService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly patientAccess: PatientAccessService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(TREATMENT_PLANS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(treatmentPlans)
        .where(this.scope.where(treatmentPlans, clinicId, eq(treatmentPlans.id, id)))
        .limit(1);

      return row ? { ...toPlan(row, EMPTY_PLAN_SUMMARY) } : null;
    });
  }

  async list(
    actor: AuthenticatedUser,
    query: ListTreatmentPlansQuery,
  ): Promise<Paginated<TreatmentPlan>> {
    const filters: (SQL | undefined)[] = [
      await this.patientAccess.assignedFilter(actor, treatmentPlans.patientId),
    ];

    if (query.patientId) {
      await this.patientAccess.requirePatientId(actor, query.patientId);
      filters.push(eq(treatmentPlans.patientId, query.patientId));
    }
    if (query.status) {
      filters.push(eq(treatmentPlans.status, query.status));
    }

    const where = this.scope.where(treatmentPlans, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(treatmentPlans)
        .where(where)
        .orderBy(desc(treatmentPlans.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(treatmentPlans)
        .where(where),
    ]);

    const summaries = await this.summariesFor(
      actor.clinicId,
      rows.map((row) => row.id),
    );

    return toPaginated(
      rows.map((row) => toPlan(row, summaries.get(row.id) ?? EMPTY_PLAN_SUMMARY)),
      totals?.value ?? 0,
      query,
    );
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<TreatmentPlan> {
    const row = await this.patientAccess.requireRow<PlanRow>(actor, treatmentPlans, id);

    return this.withSummary(actor.clinicId, row);
  }

  async create(actor: AuthenticatedUser, input: CreateTreatmentPlanInput): Promise<TreatmentPlan> {
    await this.patientAccess.requirePatientId(actor, input.patientId);
    await this.requireDoctor(actor, input.doctorId);

    const [row] = await this.db
      .insert(treatmentPlans)
      .values({
        clinicId: actor.clinicId,
        patientId: input.patientId,
        doctorId: input.doctorId,
        title: input.title,
        status: input.status,
        notes: input.notes ?? null,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create treatment plan");
    }

    return toPlan(row, EMPTY_PLAN_SUMMARY);
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateTreatmentPlanInput,
  ): Promise<TreatmentPlan> {
    await this.patientAccess.requireRow<PlanRow>(actor, treatmentPlans, id);

    if (input.doctorId) {
      await this.requireDoctor(actor, input.doctorId);
    }

    const [row] = await this.db
      .update(treatmentPlans)
      .set({
        ...(input.doctorId !== undefined && { doctorId: input.doctorId }),
        ...(input.title !== undefined && { title: input.title }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.notes !== undefined && { notes: input.notes ?? null }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(treatmentPlans, actor.clinicId, eq(treatmentPlans.id, id)))
      .returning();

    if (!row) {
      throw new Error("Failed to update treatment plan");
    }

    return this.withSummary(actor.clinicId, row);
  }

  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.patientAccess.requireRow<PlanRow>(actor, treatmentPlans, id);

    const unstarted = this.scope.where(
      performedProcedures,
      actor.clinicId,
      eq(performedProcedures.treatmentPlanId, id),
      inArray(performedProcedures.status, [
        PERFORMED_PROCEDURE_STATUS.PLANNED,
        PERFORMED_PROCEDURE_STATUS.CANCELLED,
      ]),
    );
    const treatmentIds = (
      await this.db
        .select({ id: performedProcedures.id })
        .from(performedProcedures)
        .where(unstarted)
    ).map((row) => row.id);
    const snapshot = this.auditSnapshots.get(PERFORMED_PROCEDURES_ENTITY);
    const before = await Promise.all(
      treatmentIds.map((entityId) => snapshot?.(entityId, actor.clinicId)),
    );

    await this.db.transaction(async (tx) => {
      const now = new Date();

      await tx
        .update(performedProcedures)
        .set({ deletedAt: now, updatedAt: now, updatedBy: actor.id })
        .where(unstarted);
      await tx
        .update(treatmentPlans)
        .set({ deletedAt: now, updatedAt: now, updatedBy: actor.id })
        .where(this.scope.where(treatmentPlans, actor.clinicId, eq(treatmentPlans.id, id)));

      for (const [index, entityId] of treatmentIds.entries()) {
        await this.audit.record(
          {
            clinicId: actor.clinicId,
            userId: actor.id,
            action: AUDIT_ACTION.DELETE,
            entity: PERFORMED_PROCEDURES_ENTITY,
            entityId,
            oldValue: before[index] ?? null,
            newValue: null,
          },
          tx,
        );
      }
    });
  }

  private async withSummary(clinicId: string, row: PlanRow): Promise<TreatmentPlan> {
    const summaries = await this.summariesFor(clinicId, [row.id]);

    return toPlan(row, summaries.get(row.id) ?? EMPTY_PLAN_SUMMARY);
  }

  private async summariesFor(
    clinicId: string,
    planIds: readonly string[],
  ): Promise<Map<string, PlanSummaryRow>> {
    if (planIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({ planId: performedProcedures.treatmentPlanId, ...planSummaryColumns })
      .from(performedProcedures)
      .where(
        this.scope.where(
          performedProcedures,
          clinicId,
          inArray(performedProcedures.treatmentPlanId, [...planIds]),
        ),
      )
      .groupBy(performedProcedures.treatmentPlanId);

    return new Map(
      rows.flatMap(({ planId, ...summary }) =>
        planId === null ? [] : [[planId, summary] as const],
      ),
    );
  }

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
