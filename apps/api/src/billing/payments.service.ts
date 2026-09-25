import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import {
  LOOKUP_LIST,
  PAYMENT_ERROR,
  toMinorUnits,
  type CreatePaymentInput,
  type ListPaymentsQuery,
  type Paginated,
  type Payment,
  type ReversePaymentInput,
} from "@clinic/shared";
import { desc, eq, sql, type SQL } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/audit/audit-snapshot.registry";
import { negate } from "@api/billing/charges.service";
import { LedgerService } from "@api/billing/ledger.service";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database, type DatabaseExecutor } from "@api/database/database.module";
import { clinicCounters, payments } from "@api/database/schema";
import { PatientAccessService } from "@api/patients/patient-access.service";
import { LookupsService } from "@api/lookups/lookups.service";

type PaymentRow = typeof payments.$inferSelect;

export const PAYMENTS_ENTITY = "payments";

// Append-only: never updated, never deleted. A mistake is an admin writing the opposite entry,
// which leaves the receipt and its cancellation on the statement.
@Injectable()
export class PaymentsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly lookups: LookupsService,
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

  // One transaction, so a receipt number is never handed out for a payment that then fails to
  // commit.
  async create(actor: AuthenticatedUser, input: CreatePaymentInput): Promise<Payment> {
    await this.patientAccess.requirePatientId(actor, input.patientId);
    await this.lookups.assertCode(actor.clinicId, LOOKUP_LIST.PAYMENT_METHOD, input.method);

    return this.db.transaction(async (tx) => {
      const receiptNumber = await nextReceiptNumber(tx, actor.clinicId);
      await assertWithinBalance(tx, actor.clinicId, input.patientId, input.amount);

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

      if (!row) {
        throw new Error("Failed to record payment");
      }

      return toPayment(row);
    });
  }

  // Kept, not removed: an admin still sees it on the statement, and the balance's `sum()` skips it.
  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(payments)
        .where(this.scope.where(payments, actor.clinicId, eq(payments.id, id)))
        .limit(1)
        .for("update");

      if (!row) {
        throw new NotFoundException("Resource not found");
      }
      if (row.reversesId !== null || row.reversedAt !== null) {
        throw new ConflictException(PAYMENT_ERROR.REVERSED);
      }

      await tx
        .update(payments)
        .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
        .where(eq(payments.id, row.id));
    });
  }

  // The reversal takes no receipt number: a receipt series with entries nobody was handed cannot be
  // reconciled.
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
        .for("update");

      if (!original) {
        throw new NotFoundException("Resource not found");
      }
      if (original.reversesId !== null) {
        throw new BadRequestException("A reversing entry cannot itself be reversed");
      }
      if (original.reversedAt !== null) {
        throw new BadRequestException("This payment has already been reversed");
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

      if (!row) {
        throw new Error("Failed to reverse payment");
      }

      return toPayment(row);
    });
  }
}

// Read after the counter's row lock, so two payments at once cannot both fit the same balance.
async function assertWithinBalance(
  tx: DatabaseExecutor,
  clinicId: string,
  patientId: string,
  amount: string,
): Promise<void> {
  const [row] = await tx.execute<{ balance: string }>(
    sql`select ${LedgerService.balanceOf(clinicId, patientId)}::text as balance`,
  );

  if (toMinorUnits(amount) > toMinorUnits(row?.balance ?? "0")) {
    throw new ConflictException(PAYMENT_ERROR.EXCEEDS_BALANCE);
  }
}

// Not a Postgres sequence: `nextval` does not roll back, so a failed payment would burn a number. A
// counter row rolls back, and its `UPDATE` row lock queues concurrent payments.
/** Exported for the seed, which writes a year of receipts and must not invent the sequence. */
export async function nextReceiptNumber(tx: DatabaseExecutor, clinicId: string): Promise<number> {
  await tx
    .insert(clinicCounters)
    .values({ clinicId })
    .onConflictDoNothing({ target: clinicCounters.clinicId });

  const [row] = await tx
    .update(clinicCounters)
    .set({ nextReceiptNumber: sql`${clinicCounters.nextReceiptNumber} + 1`, updatedAt: new Date() })
    .where(eq(clinicCounters.clinicId, clinicId))
    .returning({ next: clinicCounters.nextReceiptNumber });

  if (!row) {
    throw new Error("Failed to allocate a receipt number");
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
