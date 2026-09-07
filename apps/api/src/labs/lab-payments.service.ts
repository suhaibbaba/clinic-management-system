import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import {
  formatMinorUnits,
  LOOKUP_LIST,
  toMinorUnits,
  type CreateLabPaymentInput,
  type LabPayment,
  type Money,
  type Paginated,
  type PaginationQuery,
  type ReverseLabPaymentInput,
} from '@clinic/shared';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { labPayments } from '@api/database/schema';
import { LabsService } from '@api/labs/labs.service';
import { LookupsService } from '@api/lookups/lookups.service';

type PaymentRow = typeof labPayments.$inferSelect;

export const LAB_PAYMENTS_ENTITY = 'lab_payments';

/**
 * Money the clinic pays a lab.
 *
 * Append-only, exactly like patient payments (CLAUDE.md architecture decision
 * 2). There is no update and no delete: a mistake is corrected by writing the
 * negative of the entry with `reverses_id` pointing back, so the history of
 * what was paid and what was undone stays readable. That is also why the
 * balance can be a plain `sum()` — a reversal falls out of it with no special
 * case.
 *
 * ROLES.md: **technician** creates (they are the ones settling with the lab),
 * **admin** creates and reverses. A reversal is admin-only because it is the
 * only operation here that makes money appear to come back.
 */
@Injectable()
export class LabPaymentsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly lookups: LookupsService,
    private readonly scope: ClinicScopeService,
    private readonly labsService: LabsService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(LAB_PAYMENTS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(labPayments)
        .where(this.scope.where(labPayments, clinicId, eq(labPayments.id, id)))
        .limit(1);

      return row ? { ...toLabPayment(row) } : null;
    });
  }

  async list(
    actor: AuthenticatedUser,
    labId: string,
    query: PaginationQuery,
  ): Promise<Paginated<LabPayment>> {
    await this.labsService.requireRow(actor.clinicId, labId);

    const where = this.scope.where(labPayments, actor.clinicId, eq(labPayments.labId, labId));
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(labPayments)
        .where(where)
        .orderBy(desc(labPayments.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(labPayments)
        .where(where),
    ]);

    return toPaginated(rows.map(toLabPayment), totals?.value ?? 0, query);
  }

  async create(actor: AuthenticatedUser, input: CreateLabPaymentInput): Promise<LabPayment> {
    await this.labsService.requireRow(actor.clinicId, input.labId);
    // Only codes on this clinic's own list — the schema cannot know them.
    await this.lookups.assertCode(actor.clinicId, LOOKUP_LIST.PAYMENT_METHOD, input.method);

    const [row] = await this.db
      .insert(labPayments)
      .values({
        clinicId: actor.clinicId,
        labId: input.labId,
        amount: input.amount,
        method: input.method,
        note: input.note ?? null,
        // Who handed the money over, kept apart from who typed the row.
        paidBy: actor.id,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!row) {
      throw new Error('Failed to record the lab payment');
    }

    return toLabPayment(row);
  }

  /**
   * Cancels a payment by writing its opposite.
   *
   * The original is never touched beyond a `reversed_at` back-pointer, which is
   * bookkeeping rather than money: both rows stay, both are visible on the
   * statement, and the balance moves because the second row is negative.
   *
   * Locked with `for update` so two admins cannot reverse the same payment
   * twice — the second one finds `reversedAt` already set.
   */
  async reverse(
    actor: AuthenticatedUser,
    id: string,
    input: ReverseLabPaymentInput,
  ): Promise<LabPayment> {
    return this.db.transaction(async (tx) => {
      const [original] = await tx
        .select()
        .from(labPayments)
        .where(this.scope.where(labPayments, actor.clinicId, eq(labPayments.id, id)))
        .limit(1)
        .for('update');

      if (!original) {
        throw new NotFoundException('Resource not found');
      }
      if (original.reversesId !== null) {
        throw new BadRequestException('A reversing entry cannot itself be reversed');
      }
      if (original.reversedAt !== null) {
        throw new BadRequestException('This payment has already been reversed');
      }

      await tx
        .update(labPayments)
        .set({ reversedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
        .where(eq(labPayments.id, original.id));

      const [row] = await tx
        .insert(labPayments)
        .values({
          clinicId: original.clinicId,
          labId: original.labId,
          amount: negate(original.amount),
          method: original.method,
          note: input.reason,
          reversesId: original.id,
          paidBy: original.paidBy,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning();

      /* istanbul ignore next -- insert ... returning always yields a row. */
      if (!row) {
        throw new Error('Failed to reverse the lab payment');
      }

      return toLabPayment(row);
    });
  }

  /** The row behind an audit snapshot or a reversal. */
  async requireRow(clinicId: string, id: string): Promise<PaymentRow> {
    const [row] = await this.db
      .select()
      .from(labPayments)
      .where(
        and(
          eq(labPayments.id, id),
          eq(labPayments.clinicId, clinicId),
          isNull(labPayments.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException('Resource not found');
    }

    return row;
  }
}

export function toLabPayment(row: PaymentRow): LabPayment {
  return {
    id: row.id,
    clinicId: row.clinicId,
    labId: row.labId,
    amount: row.amount,
    method: row.method,
    note: row.note,
    reversesId: row.reversesId,
    paidBy: row.paidBy,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Through minor units, never a float. */
const negate = (amount: Money): Money => formatMinorUnits(-toMinorUnits(amount));
