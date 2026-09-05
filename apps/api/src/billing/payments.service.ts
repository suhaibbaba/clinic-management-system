import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import {
  type CreatePaymentInput,
  type ListPaymentsQuery,
  type Paginated,
  type Payment,
  type ReversePaymentInput,
} from '@clinic/shared';
import { desc, eq, sql, type SQL } from 'drizzle-orm';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { negate } from '@api/billing/charges.service';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database, type DatabaseExecutor } from '@api/database/database.module';
import { clinicCounters, payments } from '@api/database/schema';
import { PatientAccessService } from '@api/patients/patient-access.service';

type PaymentRow = typeof payments.$inferSelect;

export const PAYMENTS_ENTITY = 'payments';

/**
 * Money taken in.
 *
 * Append-only, like every other ledger here: a payment is never updated and
 * never deleted, and ROLES.md gives the receptionist create and read only. A
 * mistake is corrected by an admin writing the opposite entry, which leaves
 * both the original receipt and its cancellation on the statement.
 */
@Injectable()
export class PaymentsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly patientAccess: PatientAccessService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(PAYMENTS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(payments)
        .where(this.scope.where(payments, clinicId, eq(payments.id, id)))
        .limit(1);

      return row ? { ...toPayment(row) } : null;
    });
  }

  async list(actor: AuthenticatedUser, query: ListPaymentsQuery): Promise<Paginated<Payment>> {
    const filters: (SQL | undefined)[] = [];

    if (query.patientId) {
      await this.patientAccess.requirePatientId(actor, query.patientId);
      filters.push(eq(payments.patientId, query.patientId));
    }

    const where = this.scope.where(payments, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(payments)
        .where(where)
        .orderBy(desc(payments.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(payments)
        .where(where),
    ]);

    return toPaginated(rows.map(toPayment), totals?.value ?? 0, query);
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<Payment> {
    return toPayment(await this.scope.findOneOrFail<PaymentRow>(payments, actor.clinicId, id));
  }

  /**
   * Records a payment and its receipt number in one transaction, so a receipt
   * number is never handed out for a payment that then fails to commit.
   */
  async create(actor: AuthenticatedUser, input: CreatePaymentInput): Promise<Payment> {
    await this.patientAccess.requirePatientId(actor, input.patientId);

    return this.db.transaction(async (tx) => {
      const receiptNumber = await nextReceiptNumber(tx, actor.clinicId);

      const [row] = await tx
        .insert(payments)
        .values({
          clinicId: actor.clinicId,
          patientId: input.patientId,
          amount: input.amount,
          method: input.method,
          note: input.note ?? null,
          receiptNumber,
          receivedBy: actor.id,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning();

      /* istanbul ignore next -- insert ... returning always yields a row. */
      if (!row) {
        throw new Error('Failed to record payment');
      }

      return toPayment(row);
    });
  }

  /**
   * Cancels a payment by writing its opposite — admin only (ROLES.md: nobody
   * updates or deletes a payment, not even an admin).
   *
   * The reversal takes no receipt number of its own: it is documented by the
   * receipt it cancels, and a receipt sequence with entries nobody was ever
   * handed is a sequence that cannot be reconciled.
   */
  async reverse(
    actor: AuthenticatedUser,
    id: string,
    input: ReversePaymentInput,
  ): Promise<Payment> {
    return this.db.transaction(async (tx) => {
      const [original] = await tx
        .select()
        .from(payments)
        .where(this.scope.where(payments, actor.clinicId, eq(payments.id, id)))
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
        .update(payments)
        .set({ reversedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
        .where(eq(payments.id, original.id));

      const [row] = await tx
        .insert(payments)
        .values({
          clinicId: original.clinicId,
          patientId: original.patientId,
          amount: negate(original.amount),
          method: original.method,
          note: input.reason,
          receiptNumber: null,
          reversesId: original.id,
          receivedBy: original.receivedBy,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning();

      /* istanbul ignore next -- insert ... returning always yields a row. */
      if (!row) {
        throw new Error('Failed to reverse payment');
      }

      return toPayment(row);
    });
  }
}

/**
 * Takes the next receipt number for a clinic.
 *
 * A Postgres sequence would be wrong here: `nextval` does not roll back, so a
 * failed payment would burn a number and leave a hole in a document series the
 * clinic has to account for. A counter row does roll back, and the `UPDATE`
 * takes a row lock, so concurrent payments queue behind each other and every
 * number between the first and the last is on a real receipt.
 */
async function nextReceiptNumber(tx: DatabaseExecutor, clinicId: string): Promise<number> {
  await tx
    .insert(clinicCounters)
    .values({ clinicId })
    .onConflictDoNothing({ target: clinicCounters.clinicId });

  const [row] = await tx
    .update(clinicCounters)
    .set({ nextReceiptNumber: sql`${clinicCounters.nextReceiptNumber} + 1`, updatedAt: new Date() })
    .where(eq(clinicCounters.clinicId, clinicId))
    .returning({ next: clinicCounters.nextReceiptNumber });

  /* istanbul ignore next -- the row was just ensured to exist. */
  if (!row) {
    throw new Error('Failed to allocate a receipt number');
  }

  return row.next - 1;
}

export function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    amount: row.amount,
    method: row.method,
    note: row.note,
    receiptNumber: row.receiptNumber,
    reversesId: row.reversesId,
    receivedBy: row.receivedBy,
    createdAt: row.createdAt.toISOString(),
  };
}
