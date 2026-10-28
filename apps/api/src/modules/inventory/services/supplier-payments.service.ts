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
  PAYMENT_DIRECTION,
  PURCHASE_ERROR,
  toMinorUnits,
  type CreateSupplierPaymentInput,
  type PaymentDirection,
  type ReverseSupplierPaymentInput,
  type SupplierPayment,
  type SupplierRefundInput,
} from "@clinic/shared";
import { and, eq } from "drizzle-orm";
import { UNIQUE_VIOLATION } from "@api/common/constants/postgres-errors";
import { violatedConstraint } from "@api/common/lib/postgres-errors";
import { SUPPLIER_PAYMENTS_REQUEST_INDEX } from "@api/modules/inventory/constants";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database, type DatabaseExecutor } from "@api/database/database.module";
import { supplierPayments } from "@api/database/schema";
import { LookupsService } from "@api/modules/lookups/services/lookups.service";
import { SuppliersService } from "@api/modules/inventory/services/suppliers.service";
import { SupplierAllocationsService } from "@api/modules/inventory/services/supplier-allocations.service";
import { SUPPLIER_PAYMENTS_ENTITY } from "@api/common/constants/audit-entities";
import { toSupplierPayment } from "@api/modules/inventory/lib/supplier-payments";
import { negate } from "@api/common/lib/money";

@Injectable()
export class SupplierPaymentsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly lookups: LookupsService,
    private readonly scope: ClinicScopeService,
    private readonly suppliersService: SuppliersService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
    private readonly allocations: SupplierAllocationsService,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(SUPPLIER_PAYMENTS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(supplierPayments)
        .where(this.scope.where(supplierPayments, clinicId, eq(supplierPayments.id, id)))
        .limit(1);

      return row ? { ...toSupplierPayment(row) } : null;
    });
  }

  async record(
    actor: AuthenticatedUser,
    input: CreateSupplierPaymentInput,
  ): Promise<SupplierPayment> {
    if (input.requestId === undefined) {
      return this.payAndAllocate(actor, input);
    }

    const earlier = await this.byRequest(actor.clinicId, input.requestId);

    if (earlier) {
      return earlier;
    }

    try {
      return await this.payAndAllocate(actor, input);
    } catch (error) {
      const replayed =
        violatedConstraint(error, UNIQUE_VIOLATION) === SUPPLIER_PAYMENTS_REQUEST_INDEX
          ? await this.byRequest(actor.clinicId, input.requestId)
          : undefined;

      if (replayed) {
        return replayed;
      }

      throw error;
    }
  }

  async validate(actor: AuthenticatedUser, supplierId: string, method: string): Promise<void> {
    await this.suppliersService.requireRow(actor.clinicId, supplierId);
    await this.lookups.assertCode(actor.clinicId, LOOKUP_LIST.PAYMENT_METHOD, method);
  }

  private async payAndAllocate(
    actor: AuthenticatedUser,
    input: CreateSupplierPaymentInput,
  ): Promise<SupplierPayment> {
    await this.validate(actor, input.supplierId, input.method);

    return this.db.transaction(async (tx) => {
      await this.allocations.lockSupplier(tx, actor.clinicId, input.supplierId);

      const payment = await this.create(actor, input, tx);

      await this.allocations.allocatePayment(
        tx,
        actor,
        input.supplierId,
        payment.id,
        toMinorUnits(payment.amount),
      );

      return payment;
    });
  }

  async refund(actor: AuthenticatedUser, input: SupplierRefundInput): Promise<SupplierPayment> {
    await this.validate(actor, input.supplierId, input.method);

    return this.db.transaction(async (tx) => {
      await this.allocations.lockSupplier(tx, actor.clinicId, input.supplierId);

      const credit = -toMinorUnits(
        await this.suppliersService.owed(actor.clinicId, input.supplierId, tx),
      );

      if (toMinorUnits(input.amount) > credit) {
        throw new ConflictException(PURCHASE_ERROR.REFUND_EXCEEDS_CREDIT);
      }

      return this.create(actor, input, tx, null, PAYMENT_DIRECTION.REFUND);
    });
  }

  private async byRequest(
    clinicId: string,
    requestId: string,
  ): Promise<SupplierPayment | undefined> {
    const [row] = await this.db
      .select()
      .from(supplierPayments)
      .where(
        and(eq(supplierPayments.clinicId, clinicId), eq(supplierPayments.requestId, requestId)),
      )
      .limit(1);

    return row ? toSupplierPayment(row) : undefined;
  }

  async create(
    actor: AuthenticatedUser,
    input: CreateSupplierPaymentInput,
    executor: DatabaseExecutor = this.db,
    movementId: string | null = null,
    direction: PaymentDirection = PAYMENT_DIRECTION.PAID,
  ): Promise<SupplierPayment> {
    const [row] = await executor
      .insert(supplierPayments)
      .values({
        clinicId: actor.clinicId,
        supplierId: input.supplierId,
        movementId,
        amount: input.amount,
        method: input.method,
        note: input.note ?? null,
        paidBy: actor.id,
        requestId: input.requestId ?? null,
        direction,
        ...(input.paidOn !== undefined && { paidOn: input.paidOn }),
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to record the supplier payment");
    }

    return toSupplierPayment(row);
  }

  async reverse(
    actor: AuthenticatedUser,
    id: string,
    input: ReverseSupplierPaymentInput,
  ): Promise<SupplierPayment> {
    return this.db.transaction(async (tx) => {
      const [original] = await tx
        .select()
        .from(supplierPayments)
        .where(this.scope.where(supplierPayments, actor.clinicId, eq(supplierPayments.id, id)))
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

      await this.allocations.lockSupplier(tx, actor.clinicId, original.supplierId);
      await this.allocations.reverseForPayment(tx, actor, original.id, input.reason);

      await tx
        .update(supplierPayments)
        .set({ reversedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
        .where(eq(supplierPayments.id, original.id));

      const [row] = await tx
        .insert(supplierPayments)
        .values({
          clinicId: original.clinicId,
          supplierId: original.supplierId,
          movementId: original.movementId,
          amount: negate(original.amount),
          method: original.method,
          direction: original.direction,
          paidOn: original.paidOn,
          note: input.reason,
          reversesId: original.id,
          paidBy: original.paidBy,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning();

      if (!row) {
        throw new Error("Failed to reverse the supplier payment");
      }

      return toSupplierPayment(row);
    });
  }
}
