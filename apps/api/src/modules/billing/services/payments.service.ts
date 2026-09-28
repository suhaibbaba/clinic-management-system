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
  type CreatePaymentInput,
  type ListPaymentsQuery,
  type Paginated,
  type Payment,
  type ReversePaymentInput,
} from "@clinic/shared";
import { desc, eq, sql, type SQL } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { negate } from "@api/modules/billing/lib/charges";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { payments } from "@api/database/schema";
import { PatientAccessService } from "@api/modules/patients/services/patient-access.service";
import { LookupsService } from "@api/modules/lookups/services/lookups.service";
import { PAYMENTS_ENTITY } from "@api/modules/billing/constants";
import {
  toPayment,
  PaymentRow,
  nextReceiptNumber,
  assertWithinBalance,
} from "@api/modules/billing/lib/payments";

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
