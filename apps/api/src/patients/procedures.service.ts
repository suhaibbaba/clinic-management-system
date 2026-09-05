import { BadRequestException, Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  CHART_TYPE,
  USER_ROLE,
  type ChartMark,
  type CreateChartMarkInput,
  type CreatePerformedProcedureInput,
  type ListPerformedProceduresQuery,
  type Paginated,
  type PerformedProcedure,
  type UpdatePerformedProcedureInput,
} from '@clinic/shared';
import { desc, eq, inArray, sql, type SQL } from 'drizzle-orm';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ChargesService } from '@api/billing/charges.service';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database, type DatabaseExecutor } from '@api/database/database.module';
import { chartMarks, doctors, performedProcedures, specialties } from '@api/database/schema';
import { PatientAccessService } from '@api/patients/patient-access.service';
import { ProcedureCatalogService } from '@api/patients/procedure-catalog.service';

type ProcedureRow = typeof performedProcedures.$inferSelect;
type ChartMarkRow = typeof chartMarks.$inferSelect;

export const PERFORMED_PROCEDURES_ENTITY = 'performed_procedures';

@Injectable()
export class ProceduresService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly patientAccess: PatientAccessService,
    private readonly catalog: ProcedureCatalogService,
    private readonly charges: ChargesService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(PERFORMED_PROCEDURES_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(performedProcedures)
        .where(this.scope.where(performedProcedures, clinicId, eq(performedProcedures.id, id)))
        .limit(1);

      return row ? { ...toProcedure(row) } : null;
    });
  }

  async list(
    actor: AuthenticatedUser,
    query: ListPerformedProceduresQuery,
  ): Promise<Paginated<PerformedProcedure>> {
    // ROLES.md gives a technician read access to lab-linked procedures only.
    // Nothing is lab-linked until the labs module exists, so the filter is
    // structurally present and currently matches no rows.
    if (actor.role === USER_ROLE.TECHNICIAN) {
      return toPaginated<PerformedProcedure>([], 0, query);
    }

    const filters: (SQL | undefined)[] = [];

    if (query.patientId) {
      await this.patientAccess.requirePatientId(actor, query.patientId);
      filters.push(eq(performedProcedures.patientId, query.patientId));
    }
    if (query.visitId) {
      filters.push(eq(performedProcedures.visitId, query.visitId));
    }
    if (query.status) {
      filters.push(eq(performedProcedures.status, query.status));
    }

    const where = this.scope.where(performedProcedures, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(performedProcedures)
        .where(where)
        .orderBy(desc(performedProcedures.performedAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(performedProcedures)
        .where(where),
    ]);

    const marks = await this.marksFor(
      actor.clinicId,
      rows.map((row) => row.id),
    );

    return toPaginated(
      rows.map((row) => toProcedure(row, marks.get(row.id) ?? [])),
      totals?.value ?? 0,
      query,
    );
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<PerformedProcedure> {
    const row = await this.scope.findOneOrFail<ProcedureRow>(
      performedProcedures,
      actor.clinicId,
      id,
    );
    const marks = await this.marksFor(actor.clinicId, [row.id]);

    return toProcedure(row, marks.get(row.id) ?? []);
  }

  /**
   * `options.planItemId` is set only by the treatment-plan conversion, which is
   * why it is not part of the request body: a client may not staple a procedure
   * onto an arbitrary plan item.
   */
  async create(
    actor: AuthenticatedUser,
    input: CreatePerformedProcedureInput,
    options: { planItemId?: string } = {},
  ): Promise<PerformedProcedure> {
    await this.patientAccess.requirePatientId(actor, input.patientId);
    await this.requireDoctor(actor, input.doctorId);

    const catalogItem = await this.catalog.requirePriced(actor.clinicId, input.procedureId);
    // Snapshot: a later catalog price change must never rewrite history.
    const price = input.price ?? catalogItem.defaultPrice;

    await this.assertMarksMatchSpecialty(actor.clinicId, catalogItem.specialtyId, input.chartMarks);

    // One transaction: the procedure, its chart marks and the charge it raises
    // commit together or not at all. A procedure without its charge would be
    // work nobody is ever billed for, and there is no way to detect it later.
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(performedProcedures)
        .values({
          clinicId: actor.clinicId,
          patientId: input.patientId,
          visitId: input.visitId ?? null,
          doctorId: input.doctorId,
          procedureId: input.procedureId,
          price,
          discount: input.discount,
          discountReason: input.discountReason ?? null,
          status: input.status,
          planItemId: options.planItemId ?? null,
          performedAt: input.performedAt ? new Date(input.performedAt) : new Date(),
          notes: input.notes ?? null,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning();

      /* istanbul ignore next -- insert ... returning always yields a row. */
      if (!row) {
        throw new Error('Failed to create performed procedure');
      }

      const marks = await this.replaceMarks(tx, actor, row.id, input.chartMarks);

      await this.charges.onProcedureRecorded(tx, {
        clinicId: actor.clinicId,
        patientId: row.patientId,
        performedProcedureId: row.id,
        price: row.price,
        discount: row.discount,
        discountReason: row.discountReason,
        status: row.status,
        actorId: actor.id,
      });

      return toProcedure(row, marks);
    });
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdatePerformedProcedureInput,
  ): Promise<PerformedProcedure> {
    const existing = await this.scope.findOneOrFail<ProcedureRow>(
      performedProcedures,
      actor.clinicId,
      id,
    );

    if (input.doctorId) {
      await this.requireDoctor(actor, input.doctorId);
    }

    const procedureId = input.procedureId ?? existing.procedureId;
    const catalogItem = await this.catalog.requirePriced(actor.clinicId, procedureId);

    if (input.chartMarks) {
      await this.assertMarksMatchSpecialty(
        actor.clinicId,
        catalogItem.specialtyId,
        input.chartMarks,
      );
    }

    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(performedProcedures)
        .set({
          ...(input.visitId !== undefined && { visitId: input.visitId ?? null }),
          ...(input.doctorId !== undefined && { doctorId: input.doctorId }),
          ...(input.procedureId !== undefined && { procedureId: input.procedureId }),
          ...(input.price !== undefined && { price: input.price }),
          ...(input.discount !== undefined && { discount: input.discount }),
          ...(input.discountReason !== undefined && {
            discountReason: input.discountReason ?? null,
          }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.performedAt !== undefined && { performedAt: new Date(input.performedAt) }),
          ...(input.notes !== undefined && { notes: input.notes ?? null }),
          updatedAt: new Date(),
          updatedBy: actor.id,
        })
        .where(
          this.scope.where(performedProcedures, actor.clinicId, eq(performedProcedures.id, id)),
        )
        .returning();

      /* istanbul ignore next -- the row was just loaded. */
      if (!row) {
        throw new Error('Failed to update performed procedure');
      }

      const marks = input.chartMarks
        ? await this.replaceMarks(tx, actor, row.id, input.chartMarks)
        : ((await this.marksFor(actor.clinicId, [row.id])).get(row.id) ?? []);

      // What the patient owes is derived from price, discount and status, so a
      // change to any of them re-bills. Never an update: the charge in force is
      // reversed and the new figure appended (CLAUDE.md decision 2).
      const rebills =
        row.price !== existing.price ||
        row.discount !== existing.discount ||
        row.status !== existing.status;

      if (rebills) {
        await this.charges.onProcedureAmended(tx, {
          clinicId: actor.clinicId,
          patientId: row.patientId,
          performedProcedureId: row.id,
          price: row.price,
          discount: row.discount,
          discountReason: row.discountReason,
          status: row.status,
          actorId: actor.id,
        });
      }

      return toProcedure(row, marks);
    });
  }

  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.scope.findOneOrFail<ProcedureRow>(performedProcedures, actor.clinicId, id);
    const now = new Date();

    await this.db.transaction(async (tx) => {
      await tx
        .update(performedProcedures)
        .set({ deletedAt: now, updatedAt: now, updatedBy: actor.id })
        .where(
          this.scope.where(performedProcedures, actor.clinicId, eq(performedProcedures.id, id)),
        );

      // Marks have no meaning without their procedure.
      await tx
        .update(chartMarks)
        .set({ deletedAt: now, updatedAt: now, updatedBy: actor.id })
        .where(
          this.scope.where(chartMarks, actor.clinicId, eq(chartMarks.performedProcedureId, id)),
        );

      // The charge is not deleted with it — it is reversed, so the money that
      // was once owed stays visible on the statement alongside its correction.
      await this.charges.onProcedureReversed(tx, {
        clinicId: actor.clinicId,
        performedProcedureId: id,
        actorId: actor.id,
      });
    });
  }

  /** Marks are owned by their procedure, so a write replaces the whole set. */
  private async replaceMarks(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    procedureId: string,
    marks: readonly CreateChartMarkInput[],
  ): Promise<ChartMark[]> {
    const now = new Date();

    await tx
      .update(chartMarks)
      .set({ deletedAt: now, updatedAt: now, updatedBy: actor.id })
      .where(
        this.scope.where(
          chartMarks,
          actor.clinicId,
          eq(chartMarks.performedProcedureId, procedureId),
        ),
      );

    if (marks.length === 0) {
      return [];
    }

    const rows = await tx
      .insert(chartMarks)
      .values(
        marks.map((mark) => ({
          clinicId: actor.clinicId,
          performedProcedureId: procedureId,
          chartType: mark.chartType,
          location: mark.location,
          // Denormalised so tooth history is an index lookup, not a JSONB scan.
          tooth: mark.chartType === CHART_TYPE.TOOTH_FDI ? mark.location.tooth : null,
          createdBy: actor.id,
          updatedBy: actor.id,
        })),
      )
      .returning();

    return rows.map(toChartMark);
  }

  private async marksFor(
    clinicId: string,
    procedureIds: readonly string[],
  ): Promise<Map<string, ChartMark[]>> {
    if (procedureIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select()
      .from(chartMarks)
      .where(
        this.scope.where(
          chartMarks,
          clinicId,
          inArray(chartMarks.performedProcedureId, [...procedureIds]),
        ),
      );

    const grouped = new Map<string, ChartMark[]>();
    for (const row of rows) {
      const list = grouped.get(row.performedProcedureId) ?? [];
      list.push(toChartMark(row));
      grouped.set(row.performedProcedureId, list);
    }

    return grouped;
  }

  /**
   * A mark's chart type must match the specialty the procedure belongs to, so a
   * tooth can never be recorded against a skeleton chart and vice versa. The
   * rule is data-driven: the specialty row decides, not a branch on "dental".
   */
  private async assertMarksMatchSpecialty(
    clinicId: string,
    specialtyId: string,
    marks: readonly CreateChartMarkInput[],
  ): Promise<void> {
    if (marks.length === 0) {
      return;
    }

    const [specialty] = await this.db
      .select({ chartType: specialties.chartType })
      .from(specialties)
      .where(this.scope.where(specialties, clinicId, eq(specialties.id, specialtyId)))
      .limit(1);

    if (!specialty) {
      throw new BadRequestException('Specialty not found in this clinic');
    }

    if (specialty.chartType === CHART_TYPE.NONE) {
      throw new BadRequestException('This specialty does not use a chart');
    }

    const mismatched = marks.find((mark) => mark.chartType !== specialty.chartType);
    if (mismatched) {
      throw new BadRequestException(
        `Chart marks must be of type ${specialty.chartType} for this specialty`,
      );
    }
  }

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

export function toChartMark(row: ChartMarkRow): ChartMark {
  return {
    id: row.id,
    clinicId: row.clinicId,
    performedProcedureId: row.performedProcedureId,
    chartType: row.chartType as ChartMark['chartType'],
    location: row.location,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toProcedure(row: ProcedureRow, marks: ChartMark[] = []): PerformedProcedure {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    visitId: row.visitId,
    doctorId: row.doctorId,
    procedureId: row.procedureId,
    price: row.price,
    discount: row.discount,
    discountReason: row.discountReason,
    status: row.status,
    planItemId: row.planItemId,
    performedAt: row.performedAt.toISOString(),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    chartMarks: marks,
  };
}
