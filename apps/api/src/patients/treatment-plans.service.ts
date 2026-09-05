import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  type OnModuleInit,
} from '@nestjs/common';
import {
  TREATMENT_PLAN_ITEM_STATUS,
  type ConvertPlanItemInput,
  type CreateTreatmentPlanInput,
  type CreateTreatmentPlanItemInput,
  type ListTreatmentPlansQuery,
  type Paginated,
  type PerformedProcedure,
  type TreatmentPlan,
  type TreatmentPlanItem,
  type UpdateTreatmentPlanInput,
  type UpdateTreatmentPlanItemInput,
} from '@clinic/shared';
import { asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { doctors, treatmentPlanItems, treatmentPlans } from '@api/database/schema';
import { PatientAccessService } from '@api/patients/patient-access.service';
import { ProcedureCatalogService } from '@api/patients/procedure-catalog.service';
import { ProceduresService } from '@api/patients/procedures.service';

type PlanRow = typeof treatmentPlans.$inferSelect;
type PlanItemRow = typeof treatmentPlanItems.$inferSelect;

export const TREATMENT_PLANS_ENTITY = 'treatment_plans';
export const TREATMENT_PLAN_ITEMS_ENTITY = 'treatment_plan_items';

/**
 * Treatment plans and their items — admin and doctor only
 * (ROLES.md patients matrix).
 *
 * A plan item is a quote. It becomes real work exactly once, through
 * `convertItem`, which creates the performed procedure that billing later
 * charges for; the item's `estimated_price` is left alone so the quote and what
 * was actually charged stay separately readable.
 */
@Injectable()
export class TreatmentPlansService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly patientAccess: PatientAccessService,
    private readonly catalog: ProcedureCatalogService,
    private readonly procedures: ProceduresService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(TREATMENT_PLANS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(treatmentPlans)
        .where(this.scope.where(treatmentPlans, clinicId, eq(treatmentPlans.id, id)))
        .limit(1);

      return row ? { ...toPlan(row) } : null;
    });

    this.auditSnapshots.register(TREATMENT_PLAN_ITEMS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(treatmentPlanItems)
        .where(this.scope.where(treatmentPlanItems, clinicId, eq(treatmentPlanItems.id, id)))
        .limit(1);

      return row ? { ...toPlanItem(row) } : null;
    });
  }

  async list(
    actor: AuthenticatedUser,
    query: ListTreatmentPlansQuery,
  ): Promise<Paginated<TreatmentPlan>> {
    const filters: (SQL | undefined)[] = [];

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

    const items = await this.itemsFor(
      actor.clinicId,
      rows.map((row) => row.id),
    );

    return toPaginated(
      rows.map((row) => toPlan(row, items.get(row.id) ?? [])),
      totals?.value ?? 0,
      query,
    );
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<TreatmentPlan> {
    const row = await this.scope.findOneOrFail<PlanRow>(treatmentPlans, actor.clinicId, id);
    const items = await this.itemsFor(actor.clinicId, [row.id]);

    return toPlan(row, items.get(row.id) ?? []);
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

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!row) {
      throw new Error('Failed to create treatment plan');
    }

    const items: TreatmentPlanItem[] = [];
    for (const item of input.items) {
      items.push(await this.insertItem(actor, row.id, item));
    }

    return toPlan(row, items);
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateTreatmentPlanInput,
  ): Promise<TreatmentPlan> {
    await this.scope.findOneOrFail<PlanRow>(treatmentPlans, actor.clinicId, id);

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

    /* istanbul ignore next -- the row was just loaded. */
    if (!row) {
      throw new Error('Failed to update treatment plan');
    }

    const items = await this.itemsFor(actor.clinicId, [row.id]);
    return toPlan(row, items.get(row.id) ?? []);
  }

  /** Soft-deletes the plan and the items that only exist inside it. */
  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.scope.findOneOrFail<PlanRow>(treatmentPlans, actor.clinicId, id);
    const now = new Date();

    await this.db
      .update(treatmentPlans)
      .set({ deletedAt: now, updatedAt: now, updatedBy: actor.id })
      .where(this.scope.where(treatmentPlans, actor.clinicId, eq(treatmentPlans.id, id)));

    await this.db
      .update(treatmentPlanItems)
      .set({ deletedAt: now, updatedAt: now, updatedBy: actor.id })
      .where(
        this.scope.where(
          treatmentPlanItems,
          actor.clinicId,
          eq(treatmentPlanItems.treatmentPlanId, id),
        ),
      );
  }

  /* ---------------------------------------------------------------------- */
  /* Items                                                                   */
  /* ---------------------------------------------------------------------- */

  async addItem(
    actor: AuthenticatedUser,
    planId: string,
    input: CreateTreatmentPlanItemInput,
  ): Promise<TreatmentPlanItem> {
    await this.scope.findOneOrFail<PlanRow>(treatmentPlans, actor.clinicId, planId);

    return this.insertItem(actor, planId, input);
  }

  async updateItem(
    actor: AuthenticatedUser,
    itemId: string,
    input: UpdateTreatmentPlanItemInput,
  ): Promise<TreatmentPlanItem> {
    const existing = await this.requireItem(actor, itemId);

    if (existing.status === TREATMENT_PLAN_ITEM_STATUS.CONVERTED) {
      throw new ConflictException('A converted plan item can no longer be edited');
    }
    if (input.procedureId) {
      await this.catalog.requirePriced(actor.clinicId, input.procedureId);
    }

    const [row] = await this.db
      .update(treatmentPlanItems)
      .set({
        ...(input.procedureId !== undefined && { procedureId: input.procedureId }),
        ...(input.estimatedPrice !== undefined && { estimatedPrice: input.estimatedPrice }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.notes !== undefined && { notes: input.notes ?? null }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(
        this.scope.where(treatmentPlanItems, actor.clinicId, eq(treatmentPlanItems.id, itemId)),
      )
      .returning();

    /* istanbul ignore next -- the row was just loaded. */
    if (!row) {
      throw new Error('Failed to update treatment plan item');
    }

    return toPlanItem(row);
  }

  async softDeleteItem(actor: AuthenticatedUser, itemId: string): Promise<void> {
    const existing = await this.requireItem(actor, itemId);

    if (existing.status === TREATMENT_PLAN_ITEM_STATUS.CONVERTED) {
      throw new ConflictException('A converted plan item can no longer be removed');
    }

    const now = new Date();
    await this.db
      .update(treatmentPlanItems)
      .set({ deletedAt: now, updatedAt: now, updatedBy: actor.id })
      .where(
        this.scope.where(treatmentPlanItems, actor.clinicId, eq(treatmentPlanItems.id, itemId)),
      );
  }

  /**
   * Turns a planned item into work actually carried out.
   *
   * The item is a quote, so the price is re-snapshotted here: the caller may
   * override it, otherwise the estimate carries over. `planned → converted` is
   * a one-way transition, which is also enforced by a partial unique index on
   * `performed_procedures.plan_item_id`.
   */
  async convertItem(
    actor: AuthenticatedUser,
    itemId: string,
    input: ConvertPlanItemInput,
  ): Promise<PerformedProcedure> {
    const item = await this.requireItem(actor, itemId);

    if (item.status !== TREATMENT_PLAN_ITEM_STATUS.PLANNED) {
      throw new ConflictException(`A ${item.status} plan item cannot be converted`);
    }

    const plan = await this.scope.findOneOrFail<PlanRow>(
      treatmentPlans,
      actor.clinicId,
      item.treatmentPlanId,
    );

    const procedure = await this.procedures.create(
      actor,
      {
        patientId: plan.patientId,
        visitId: input.visitId ?? null,
        doctorId: input.doctorId ?? plan.doctorId,
        procedureId: item.procedureId,
        price: input.price ?? item.estimatedPrice,
        discount: '0.00',
        status: 'done',
        ...(input.performedAt !== undefined && { performedAt: input.performedAt }),
        chartMarks: [],
      },
      { planItemId: item.id },
    );

    await this.db
      .update(treatmentPlanItems)
      .set({
        status: TREATMENT_PLAN_ITEM_STATUS.CONVERTED,
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(
        this.scope.where(treatmentPlanItems, actor.clinicId, eq(treatmentPlanItems.id, item.id)),
      );

    return procedure;
  }

  /* ---------------------------------------------------------------------- */
  /* Helpers                                                                 */
  /* ---------------------------------------------------------------------- */

  private async insertItem(
    actor: AuthenticatedUser,
    planId: string,
    input: CreateTreatmentPlanItemInput,
  ): Promise<TreatmentPlanItem> {
    const catalogItem = await this.catalog.requirePriced(actor.clinicId, input.procedureId);

    const [row] = await this.db
      .insert(treatmentPlanItems)
      .values({
        clinicId: actor.clinicId,
        treatmentPlanId: planId,
        procedureId: input.procedureId,
        // The quote defaults to today's catalog price and then stands on its own.
        estimatedPrice: input.estimatedPrice ?? catalogItem.defaultPrice,
        sortOrder: input.sortOrder,
        notes: input.notes ?? null,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!row) {
      throw new Error('Failed to create treatment plan item');
    }

    return toPlanItem(row);
  }

  private async requireItem(actor: AuthenticatedUser, itemId: string): Promise<PlanItemRow> {
    return this.scope.findOneOrFail<PlanItemRow>(treatmentPlanItems, actor.clinicId, itemId);
  }

  private async itemsFor(
    clinicId: string,
    planIds: readonly string[],
  ): Promise<Map<string, TreatmentPlanItem[]>> {
    if (planIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select()
      .from(treatmentPlanItems)
      .where(
        this.scope.where(
          treatmentPlanItems,
          clinicId,
          inArray(treatmentPlanItems.treatmentPlanId, [...planIds]),
        ),
      )
      .orderBy(asc(treatmentPlanItems.sortOrder));

    const grouped = new Map<string, TreatmentPlanItem[]>();
    for (const row of rows) {
      const list = grouped.get(row.treatmentPlanId) ?? [];
      list.push(toPlanItem(row));
      grouped.set(row.treatmentPlanId, list);
    }

    return grouped;
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

export function toPlanItem(row: PlanItemRow): TreatmentPlanItem {
  return {
    id: row.id,
    clinicId: row.clinicId,
    treatmentPlanId: row.treatmentPlanId,
    procedureId: row.procedureId,
    estimatedPrice: row.estimatedPrice,
    sortOrder: row.sortOrder,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPlan(row: PlanRow, items: TreatmentPlanItem[] = []): TreatmentPlan {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    doctorId: row.doctorId,
    title: row.title,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    items,
  };
}
