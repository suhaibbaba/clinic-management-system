import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import {
  LOOKUP_LIST,
  type CreateSupplierPaymentInput,
  type ReverseSupplierPaymentInput,
  type SupplierPayment,
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
      return this.create(actor, input);
    }

    const earlier = await this.byRequest(actor.clinicId, input.requestId);

    if (earlier) {
      return earlier;
    }

    try {
      return await this.create(actor, input);
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
  ): Promise<SupplierPayment> {
    await this.suppliersService.requireRow(actor.clinicId, input.supplierId);
    await this.lookups.assertCode(actor.clinicId, LOOKUP_LIST.PAYMENT_METHOD, input.method);

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
