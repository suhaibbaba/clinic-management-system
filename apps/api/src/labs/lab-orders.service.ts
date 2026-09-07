import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import {
  awaitingLab,
  canTransitionLabOrder,
  LAB_ORDER_AWAITING_STATUSES,
  LAB_ORDER_STATUS,
  USER_ROLE,
  type CreateLabOrderInput,
  type LabOrder,
  type LabOrderRow,
  type LabOrderStatus,
  type ListLabOrdersQuery,
  type Paginated,
  type UpdateLabOrderInput,
} from '@clinic/shared';
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, or, sql, type SQL } from 'drizzle-orm';

import { AppointmentAccessService } from '@api/appointments/appointment-access.service';
import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import {
  chartMarks,
  doctors,
  labOrders,
  labWorkTypes,
  labs,
  patients,
  users,
} from '@api/database/schema';
import { LabWorkTypesService } from '@api/labs/lab-work-types.service';
import { LabsService } from '@api/labs/labs.service';

type OrderRow = typeof labOrders.$inferSelect;

export const LAB_ORDERS_ENTITY = 'lab_orders';

/**
 * Who may make each move.
 *
 * ROLES.md gives a technician "status transitions, receiving" and a doctor
 * "create/edit own" — so the split below is: the technician runs the
 * conversation with the lab (sending, chasing, receiving), and the doctor owns
 * the two moments that happen in the chair (fitting, and declaring that the
 * work is wrong). Admin passes everything, as everywhere else.
 *
 * `cancelled` is reachable only before the lab has done anything, which is why
 * a doctor may cancel their own draft without it being a financial decision.
 */
const TRANSITION_ROLES: Record<LabOrderStatus, readonly string[]> = {
  [LAB_ORDER_STATUS.DRAFT]: [],
  [LAB_ORDER_STATUS.SENT]: [USER_ROLE.TECHNICIAN, USER_ROLE.DOCTOR],
  [LAB_ORDER_STATUS.READY]: [USER_ROLE.TECHNICIAN],
  [LAB_ORDER_STATUS.RECEIVED]: [USER_ROLE.TECHNICIAN],
  [LAB_ORDER_STATUS.FITTED]: [USER_ROLE.DOCTOR],
  [LAB_ORDER_STATUS.RETURNED]: [USER_ROLE.TECHNICIAN, USER_ROLE.DOCTOR],
  [LAB_ORDER_STATUS.CANCELLED]: [USER_ROLE.TECHNICIAN, USER_ROLE.DOCTOR],
};

/**
 * Lab orders: the work the clinic sends out and waits for.
 *
 * Three rules shape this service.
 *
 * **The state machine is the shared table, not this file.** Every move goes
 * through `changeStatus`, which asks `canTransitionLabOrder` — so the rules are
 * one table in `@clinic/shared` rather than six endpoints each remembering
 * part of them (CLAUDE.md architecture decision 7).
 *
 * **The dates are written by the moves.** `sent_at`, `received_at` and
 * `fitted_at` are set by the transition that means them. A form that could set
 * them independently is a form that eventually disagrees with the status.
 *
 * **The price is a snapshot.** It is copied from the work type when the order
 * is placed, exactly like a charge's amount, so a lab's new price list cannot
 * rewrite what the clinic already owes.
 */
@Injectable()
export class LabOrdersService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly labsService: LabsService,
    private readonly workTypes: LabWorkTypesService,
    private readonly access: AppointmentAccessService,
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

  /* ---------------------------------------------------------------------- */
  /* Reads                                                                   */
  /* ---------------------------------------------------------------------- */

  async list(actor: AuthenticatedUser, query: ListLabOrdersQuery): Promise<Paginated<LabOrderRow>> {
    const filters: (SQL | undefined)[] = [];

    if (query.status) {
      filters.push(eq(labOrders.status, query.status));
    }
    if (query.labId) {
      filters.push(eq(labOrders.labId, query.labId));
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
    if (query.search) {
      const pattern = `%${query.search}%`;
      filters.push(
        or(
          sql`${patients.fullName} ilike ${pattern}`,
          sql`${patients.fileNumber} ilike ${pattern}`,
          sql`${labs.name} ilike ${pattern}`,
        ),
      );
    }

    const where = this.scope.where(labOrders, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.rowsQuery()
        .where(where)
        // Newest first, but a late order is what somebody opened the board for.
        .orderBy(desc(labOrders.createdAt))
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

  async findOne(actor: AuthenticatedUser, id: string): Promise<LabOrderRow> {
    const [row] = await this.rowsQuery()
      .where(this.scope.where(labOrders, actor.clinicId, eq(labOrders.id, id)))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Resource not found');
    }

    return toLabOrderRow(row);
  }

  /**
   * Everything late, oldest first.
   *
   * "Late" is past the date the lab promised and still out — see
   * `LAB_ORDER_AWAITING_STATUSES`. Once the work is back nobody is waiting,
   * however late it was, which is why a received order drops off this list
   * rather than staying red forever.
   */
  async overdue(actor: AuthenticatedUser, limit = 20): Promise<LabOrderRow[]> {
    const rows = await this.rowsQuery()
      .where(this.scope.where(labOrders, actor.clinicId, overdueFilter()))
      .orderBy(asc(labOrders.expectedAt))
      .limit(limit);

    return rows.map(toLabOrderRow);
  }

  /* ---------------------------------------------------------------------- */
  /* Writes                                                                  */
  /* ---------------------------------------------------------------------- */

  /**
   * Raises an order, in `draft`.
   *
   * Draft rather than sent, always: the order sheet is printed and handed to a
   * courier, and until that happens the clinic owes nothing. Sending is a
   * separate act with its own timestamp.
   *
   * Teeth may be prefilled from the procedure that needs the work — a crown on
   * 26 is ordered from the chart, and retyping the tooth number is how the lab
   * ends up making it for the wrong one.
   */
  async create(actor: AuthenticatedUser, input: CreateLabOrderInput): Promise<LabOrderRow> {
    await this.labsService.requireRow(actor.clinicId, input.labId);
    await this.access.requireOwnCalendar(actor, input.doctorId);
    await this.requirePatient(actor.clinicId, input.patientId);

    const workType = input.workTypeId
      ? await this.workTypes.requireRow(actor.clinicId, input.workTypeId)
      : null;

    if (workType && workType.labId !== input.labId) {
      throw new BadRequestException('That work type belongs to another lab');
    }

    const teeth =
      input.teeth ??
      (input.performedProcedureId
        ? await this.teethOfProcedure(actor.clinicId, input.performedProcedureId)
        : []);

    // A doctor may not set the price (ROLES.md: "not financial fields"), so
    // theirs is the list price whatever they sent.
    const price =
      actor.role === USER_ROLE.DOCTOR
        ? (workType?.defaultPrice ?? '0.00')
        : (input.price ?? workType?.defaultPrice ?? '0.00');

    const [row] = await this.db
      .insert(labOrders)
      .values({
        clinicId: actor.clinicId,
        labId: input.labId,
        patientId: input.patientId,
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
      .returning({ id: labOrders.id });

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!row) {
      throw new Error('Failed to create the lab order');
    }

    return this.findOne(actor, row.id);
  }

  /**
   * Edits the work itself — never the status, and never the price for a doctor.
   *
   * An order that has left the building is not editable at all: the lab is
   * already working from the sheet that was sent, so changing the shade here
   * would put the record out of step with what is on the bench. That is a new
   * instruction to the lab, which in this system is a return or a new order.
   */
  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateLabOrderInput,
  ): Promise<LabOrderRow> {
    const existing = await this.requireRow(actor.clinicId, id);
    await this.requireOwnOrder(actor, existing);

    if (existing.status !== LAB_ORDER_STATUS.DRAFT) {
      throw new BadRequestException('Only a draft order can be edited');
    }

    if (input.price !== undefined && actor.role === USER_ROLE.DOCTOR) {
      throw new ForbiddenException('A doctor may not set the price of lab work');
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

  /**
   * The one door into the state machine.
   *
   * Everything a status change implies happens here: the transition is checked
   * against the shared table, the role against `TRANSITION_ROLES`, and the
   * timestamp that the new status *means* is written with it.
   */
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

    const allowed = TRANSITION_ROLES[next];
    if (actor.role !== USER_ROLE.ADMIN && !allowed.includes(actor.role)) {
      throw new ForbiddenException(`Your role may not move a lab order to ${next}`);
    }

    if (actor.role === USER_ROLE.DOCTOR) {
      await this.requireOwnOrder(actor, existing);
    }

    if (next === LAB_ORDER_STATUS.RETURNED && !reason?.trim()) {
      throw new BadRequestException('A return must state a reason');
    }

    const now = new Date();

    await this.db
      .update(labOrders)
      .set({
        status: next,
        // Each timestamp belongs to exactly one move. Re-sending a returned
        // order overwrites `sent_at`, which is right: it is out again, and the
        // wait that matters is the one running now.
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

  /** The order behind an attachment or a printed sheet. */
  async requireRow(clinicId: string, id: string): Promise<OrderRow> {
    return this.scope.findOneOrFail<OrderRow>(labOrders, clinicId, id);
  }

  /* ---------------------------------------------------------------------- */
  /* Internals                                                               */
  /* ---------------------------------------------------------------------- */

  /** One shape for every order read, so a row always has its four names. */
  private rowsQuery() {
    return this.db
      .select({
        order: labOrders,
        patientName: patients.fullName,
        patientFileNumber: patients.fileNumber,
        doctorName: users.name,
        labName: labs.name,
        workTypeName: labWorkTypes.nameAr,
      })
      .from(labOrders)
      .innerJoin(patients, eq(patients.id, labOrders.patientId))
      .innerJoin(labs, eq(labs.id, labOrders.labId))
      .innerJoin(doctors, eq(doctors.id, labOrders.doctorId))
      .innerJoin(users, eq(users.id, doctors.userId))
      .leftJoin(labWorkTypes, eq(labWorkTypes.id, labOrders.workTypeId))
      .$dynamic();
  }

  /** ROLES.md: a doctor creates and edits their **own** orders. */
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
      throw new NotFoundException('Resource not found');
    }
  }

  /**
   * The teeth a performed procedure was marked on.
   *
   * This is what makes "order this from the lab" one click on the chart: the
   * crown that was just recorded on 26 becomes an order for 26 without anyone
   * retyping a number that a lab will cut metal to.
   */
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
      .filter((tooth): tooth is number => typeof tooth === 'number');

    return [...new Set(teeth)].sort((left, right) => left - right);
  }
}

/** Past the date the lab promised, and still out at the lab. */
function overdueFilter(): SQL {
  return and(
    isNotNull(labOrders.expectedAt),
    lt(labOrders.expectedAt, sql`now()`),
    inArray(labOrders.status, [...LAB_ORDER_AWAITING_STATUSES]),
  ) as SQL;
}

export function toLabOrder(row: OrderRow): LabOrder {
  return {
    id: row.id,
    clinicId: row.clinicId,
    labId: row.labId,
    patientId: row.patientId,
    doctorId: row.doctorId,
    performedProcedureId: row.performedProcedureId,
    workTypeId: row.workTypeId,
    material: row.material,
    shade: row.shade,
    teeth: row.teeth,
    instructions: row.instructions,
    price: row.price,
    status: row.status,
    sentAt: row.sentAt?.toISOString() ?? null,
    expectedAt: row.expectedAt?.toISOString() ?? null,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    fittedAt: row.fittedAt?.toISOString() ?? null,
    returnReason: row.returnReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

interface JoinedOrderRow {
  readonly order: OrderRow;
  readonly patientName: string;
  readonly patientFileNumber: string;
  readonly doctorName: string;
  readonly labName: string;
  readonly workTypeName: string | null;
}

export function toLabOrderRow(row: JoinedOrderRow): LabOrderRow {
  const order = toLabOrder(row.order);

  return {
    ...order,
    patientName: row.patientName,
    patientFileNumber: row.patientFileNumber,
    doctorName: row.doctorName,
    labName: row.labName,
    workTypeName: row.workTypeName,
    // Computed rather than stored: "late" is a fact about now, and a column
    // holding it would be wrong every day at midnight.
    isOverdue:
      order.expectedAt !== null &&
      awaitingLab(order.status) &&
      new Date(order.expectedAt) < new Date(),
  };
}
