import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import {
  canTransitionLabOrder,
  LAB_ORDER_DONE_STATUSES,
  LAB_ORDER_STAGE_STATUSES,
  LAB_ORDER_STAGES,
  LAB_ORDER_STATUS,
  LOOKUP_LIST,
  USER_ROLE,
  type CreateLabOrderInput,
  type LabOrderRow,
  type LabOrderStage,
  type LabOrderStageCounts,
  type LabOrderStageCountsQuery,
  type LabOrderStatus,
  type ListLabOrdersQuery,
  type Paginated,
  type UpdateLabOrderInput,
} from "@clinic/shared";
import { and, asc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { AppointmentAccessService } from "@api/modules/appointments/services/appointment-access.service";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { arabicNameSearch } from "@api/common/database/arabic-search";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import {
  chartMarks,
  doctors,
  labOrders,
  labWorkTypes,
  labs,
  patients,
  users,
} from "@api/database/schema";
import { LabWorkTypesService } from "@api/modules/labs/services/lab-work-types.service";
import { LabsService } from "@api/modules/labs/services/labs.service";
import { LookupsService } from "@api/modules/lookups/services/lookups.service";
import { PatientRegistrationService } from "@api/modules/patients/services/patient-registration.service";
import { OPEN_STATUSES } from "@api/modules/labs/constants";
import { LAB_ORDERS_ENTITY } from "@api/common/constants/audit-entities";
import {
  toLabOrder,
  overdueFilter,
  finishedAt,
  orderFor,
  toLabOrderRow,
  OrderRow,
} from "@api/modules/labs/lib/lab-orders";

@Injectable()
export class LabOrdersService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly lookups: LookupsService,
    private readonly scope: ClinicScopeService,
    private readonly labsService: LabsService,
    private readonly workTypes: LabWorkTypesService,
    private readonly access: AppointmentAccessService,
    private readonly registration: PatientRegistrationService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(LAB_ORDERS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(labOrders)
        .where(this.scope.where(labOrders, clinicId, eq(labOrders.id, id)))
        .limit(1);

      return row ? { ...toLabOrder(row) } : null;
    });
  }

  async list(actor: AuthenticatedUser, query: ListLabOrdersQuery): Promise<Paginated<LabOrderRow>> {
    const filters = this.sharedFilters(query);

    if (query.status) {
      filters.push(eq(labOrders.status, query.status));
    }
    if (query.patientId) {
      filters.push(eq(labOrders.patientId, query.patientId));
    }
    if (query.doctorId) {
      filters.push(eq(labOrders.doctorId, query.doctorId));
    }
    if (query.overdue) {
      filters.push(overdueFilter());
    }
    if (query.view === "open") {
      filters.push(inArray(labOrders.status, OPEN_STATUSES));
    }
    if (query.view === "done") {
      filters.push(inArray(labOrders.status, [...LAB_ORDER_DONE_STATUSES]));
    }
    if (query.stage) {
      filters.push(inArray(labOrders.status, [...LAB_ORDER_STAGE_STATUSES[query.stage]]));
    }
    if (query.finishedFrom) {
      filters.push(sql`${finishedAt} >= ${query.finishedFrom}::timestamptz`);
    }
    if (query.finishedTo) {
      filters.push(sql`${finishedAt} < ${query.finishedTo}::timestamptz`);
    }

    const where = this.scope.where(labOrders, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.rowsQuery()
        .where(where)
        .orderBy(...orderFor(query))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(labOrders)
        .innerJoin(patients, eq(patients.id, labOrders.patientId))
        .innerJoin(labs, eq(labs.id, labOrders.labId))
        .where(where),
    ]);

    return toPaginated(rows.map(toLabOrderRow), totals?.value ?? 0, query);
  }

  async stageCounts(
    actor: AuthenticatedUser,
    query: LabOrderStageCountsQuery,
  ): Promise<LabOrderStageCounts> {
    const where = this.scope.where(
      labOrders,
      actor.clinicId,
      ...this.sharedFilters(query),
      inArray(labOrders.status, OPEN_STATUSES),
    );

    const [byStatus, [overdue]] = await Promise.all([
      this.db
        .select({ status: labOrders.status, value: sql<number>`count(*)::int` })
        .from(labOrders)
        .innerJoin(patients, eq(patients.id, labOrders.patientId))
        .innerJoin(labs, eq(labs.id, labOrders.labId))
        .where(where)
        .groupBy(labOrders.status),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(labOrders)
        .innerJoin(patients, eq(patients.id, labOrders.patientId))
        .innerJoin(labs, eq(labs.id, labOrders.labId))
        .where(and(where, overdueFilter())),
    ]);

    const stages = Object.fromEntries(
      LAB_ORDER_STAGES.map((stage) => [
        stage,
        byStatus
          .filter((row) =>
            (LAB_ORDER_STAGE_STATUSES[stage] as readonly LabOrderStatus[]).includes(row.status),
          )
          .reduce((sum, row) => sum + row.value, 0),
      ]),
    ) as Record<LabOrderStage, number>;

    return { stages, overdue: overdue?.value ?? 0 };
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<LabOrderRow> {
    const [row] = await this.rowsQuery()
      .where(this.scope.where(labOrders, actor.clinicId, eq(labOrders.id, id)))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Resource not found");
    }

    return toLabOrderRow(row);
  }

  async overdue(actor: AuthenticatedUser, limit = 20): Promise<LabOrderRow[]> {
    const rows = await this.rowsQuery()
      .where(this.scope.where(labOrders, actor.clinicId, overdueFilter()))
      .orderBy(asc(labOrders.expectedAt))
      .limit(limit);

    return rows.map(toLabOrderRow);
  }

  async create(actor: AuthenticatedUser, input: CreateLabOrderInput): Promise<LabOrderRow> {
    await this.lookups.assertOptionalCode(actor.clinicId, LOOKUP_LIST.LAB_MATERIAL, input.material);
    await this.lookups.assertOptionalCode(actor.clinicId, LOOKUP_LIST.LAB_SHADE, input.shade);

    await this.labsService.requireRow(actor.clinicId, input.labId);
    await this.access.requireOwnCalendar(actor, input.doctorId);

    if (input.patientId) {
      await this.requirePatient(actor.clinicId, input.patientId);
    }

    const workType = input.workTypeId
      ? await this.workTypes.requireRow(actor.clinicId, input.workTypeId)
      : null;

    if (workType && workType.labId !== input.labId) {
      throw new BadRequestException("That work type belongs to another lab");
    }

    const teeth =
      input.teeth ??
      (input.performedProcedureId
        ? await this.teethOfProcedure(actor.clinicId, input.performedProcedureId)
        : []);

    const price =
      actor.role === USER_ROLE.DOCTOR
        ? (workType?.defaultPrice ?? "0.00")
        : (input.price ?? workType?.defaultPrice ?? "0.00");

    const [row] = await this.registration.withPatient(actor, input, (executor, patientId) =>
      executor
        .insert(labOrders)
        .values({
          clinicId: actor.clinicId,
          labId: input.labId,
          patientId,
          doctorId: input.doctorId,
          performedProcedureId: input.performedProcedureId ?? null,
          workTypeId: input.workTypeId ?? null,
          material: input.material ?? null,
          shade: input.shade ?? null,
          teeth,
          instructions: input.instructions ?? null,
          price,
          status: LAB_ORDER_STATUS.DRAFT,
          expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning({ id: labOrders.id }),
    );

    if (!row) {
      throw new Error("Failed to create the lab order");
    }

    return this.findOne(actor, row.id);
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateLabOrderInput,
  ): Promise<LabOrderRow> {
    await this.lookups.assertOptionalCode(actor.clinicId, LOOKUP_LIST.LAB_MATERIAL, input.material);
    await this.lookups.assertOptionalCode(actor.clinicId, LOOKUP_LIST.LAB_SHADE, input.shade);

    const existing = await this.requireRow(actor.clinicId, id);
    await this.requireOwnOrder(actor, existing);

    if (existing.status !== LAB_ORDER_STATUS.DRAFT) {
      throw new BadRequestException("Only a draft order can be edited");
    }

    if (input.price !== undefined && actor.role === USER_ROLE.DOCTOR) {
      throw new ForbiddenException("A doctor may not set the price of lab work");
    }

    if (input.labId) {
      await this.labsService.requireRow(actor.clinicId, input.labId);
    }
    if (input.workTypeId) {
      await this.workTypes.requireRow(actor.clinicId, input.workTypeId);
    }

    await this.db
      .update(labOrders)
      .set({
        ...(input.labId !== undefined && { labId: input.labId }),
        ...(input.workTypeId !== undefined && { workTypeId: input.workTypeId ?? null }),
        ...(input.performedProcedureId !== undefined && {
          performedProcedureId: input.performedProcedureId ?? null,
        }),
        ...(input.material !== undefined && { material: input.material ?? null }),
        ...(input.shade !== undefined && { shade: input.shade ?? null }),
        ...(input.teeth !== undefined && { teeth: input.teeth }),
        ...(input.instructions !== undefined && { instructions: input.instructions ?? null }),
        ...(input.price !== undefined && { price: input.price }),
        ...(input.expectedAt !== undefined && {
          expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
        }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(labOrders, actor.clinicId, eq(labOrders.id, id)));

    return this.findOne(actor, id);
  }

  async changeStatus(
    actor: AuthenticatedUser,
    id: string,
    next: LabOrderStatus,
    reason?: string,
  ): Promise<LabOrderRow> {
    const existing = await this.requireRow(actor.clinicId, id);

    if (!canTransitionLabOrder(existing.status, next)) {
      throw new BadRequestException(`A lab order cannot go from ${existing.status} to ${next}`);
    }

    if (actor.role === USER_ROLE.DOCTOR) {
      await this.requireOwnOrder(actor, existing);
    }

    if (next === LAB_ORDER_STATUS.RETURNED && !reason?.trim()) {
      throw new BadRequestException("A return must state a reason");
    }

    const now = new Date();

    await this.db
      .update(labOrders)
      .set({
        status: next,
        ...(next === LAB_ORDER_STATUS.SENT && { sentAt: now, receivedAt: null, fittedAt: null }),
        ...(next === LAB_ORDER_STATUS.RECEIVED && { receivedAt: now }),
        ...(next === LAB_ORDER_STATUS.FITTED && { fittedAt: now }),
        ...(next === LAB_ORDER_STATUS.RETURNED && { returnReason: reason?.trim() ?? null }),
        updatedAt: now,
        updatedBy: actor.id,
      })
      .where(this.scope.where(labOrders, actor.clinicId, eq(labOrders.id, id)));

    return this.findOne(actor, id);
  }

  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.requireRow(actor.clinicId, id);

    await this.db
      .update(labOrders)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(labOrders, actor.clinicId, eq(labOrders.id, id)));
  }

  async requireRow(clinicId: string, id: string): Promise<OrderRow> {
    return this.scope.findOneOrFail<OrderRow>(labOrders, clinicId, id);
  }

  private sharedFilters(query: LabOrderStageCountsQuery): (SQL | undefined)[] {
    const filters: (SQL | undefined)[] = [];

    if (query.labId) {
      filters.push(eq(labOrders.labId, query.labId));
    }
    if (query.search) {
      const pattern = `%${query.search}%`;
      filters.push(
        or(
          arabicNameSearch(patients.normalizedName, query.search)?.match,
          arabicNameSearch(labs.normalizedName, query.search)?.match,
          sql`${patients.fileNumber} ilike ${pattern}`,
        ),
      );
    }

    return filters;
  }

  private rowsQuery() {
    return this.db
      .select({
        order: labOrders,
        patientName: patients.fullName,
        patientFileNumber: patients.fileNumber,
        doctorNameAr: users.nameAr,
        doctorNameEn: users.nameEn,
        labName: labs.name,
        workTypeName: labWorkTypes.name,
      })
      .from(labOrders)
      .innerJoin(patients, eq(patients.id, labOrders.patientId))
      .innerJoin(labs, eq(labs.id, labOrders.labId))
      .innerJoin(doctors, eq(doctors.id, labOrders.doctorId))
      .innerJoin(users, eq(users.id, doctors.userId))
      .leftJoin(labWorkTypes, eq(labWorkTypes.id, labOrders.workTypeId))
      .$dynamic();
  }

  private async requireOwnOrder(actor: AuthenticatedUser, order: OrderRow): Promise<void> {
    await this.access.requireOwnCalendar(actor, order.doctorId);
  }

  private async requirePatient(clinicId: string, patientId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(
        and(
          eq(patients.id, patientId),
          eq(patients.clinicId, clinicId),
          isNull(patients.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException("Resource not found");
    }
  }

  private async teethOfProcedure(clinicId: string, procedureId: string): Promise<number[]> {
    const rows = await this.db
      .select({ location: chartMarks.location })
      .from(chartMarks)
      .where(
        and(
          eq(chartMarks.clinicId, clinicId),
          eq(chartMarks.performedProcedureId, procedureId),
          isNull(chartMarks.deletedAt),
        ),
      );

    const teeth = rows
      .map((row) => (row.location as { tooth?: number }).tooth)
      .filter((tooth): tooth is number => typeof tooth === "number");

    return [...new Set(teeth)].sort((left, right) => left - right);
  }
}
