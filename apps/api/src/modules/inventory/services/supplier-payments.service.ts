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
import { eq } from "drizzle-orm";
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
