import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  AUDIT_ACTION,
  PAYMENT_DIRECTION,
  PURCHASE_DOCUMENT_STATUS,
  PURCHASE_ERROR,
  formatMinorUnits,
  toMinorUnits,
} from "@clinic/shared";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database, type DatabaseExecutor } from "@api/database/database.module";
import {
  supplierAllocations,
  supplierInvoices,
  supplierPayments,
  suppliers,
} from "@api/database/schema";
import { AuditService } from "@api/modules/audit/services/audit.service";
import { SUPPLIER_PAYMENTS_ENTITY } from "@api/common/constants/audit-entities";

interface Open {
  readonly id: string;
  readonly open: number;
}

const active = and(isNull(supplierAllocations.reversesId), isNull(supplierAllocations.reversedAt));

@Injectable()
export class SupplierAllocationsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async lockSupplier(tx: DatabaseExecutor, clinicId: string, supplierId: string): Promise<void> {
    const [row] = await tx
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(eq(suppliers.id, supplierId), eq(suppliers.clinicId, clinicId)))
      .for("update");

    if (!row) {
      throw new NotFoundException("Resource not found");
    }
  }

  async openInvoices(tx: DatabaseExecutor, clinicId: string, supplierId: string): Promise<Open[]> {
    const rows = await tx
      .select({
        id: supplierInvoices.id,
        open: sql<string>`(${supplierInvoices.total} - coalesce((
          select sum(a.amount) from supplier_allocations a
          where a.invoice_id = "supplier_invoices"."id" and a.reverses_id is null and a.reversed_at is null
        ), 0))::text`,
      })
      .from(supplierInvoices)
      .where(
        and(
          eq(supplierInvoices.clinicId, clinicId),
          eq(supplierInvoices.supplierId, supplierId),
          eq(supplierInvoices.status, PURCHASE_DOCUMENT_STATUS.POSTED),
        ),
      )
      .orderBy(asc(supplierInvoices.invoiceDate), asc(supplierInvoices.number));

    return rows
      .map((row) => ({ id: row.id, open: toMinorUnits(row.open) }))
      .filter((row) => row.open > 0);
  }

  async unallocatedPayments(
    tx: DatabaseExecutor,
    clinicId: string,
    supplierId: string,
  ): Promise<Open[]> {
    const rows = await tx
      .select({
        id: supplierPayments.id,
        open: sql<string>`(${supplierPayments.amount} - coalesce((
          select sum(a.amount) from supplier_allocations a
          where a.payment_id = "supplier_payments"."id" and a.reverses_id is null and a.reversed_at is null
        ), 0))::text`,
      })
      .from(supplierPayments)
      .where(
        and(
          eq(supplierPayments.clinicId, clinicId),
          eq(supplierPayments.supplierId, supplierId),
          eq(supplierPayments.direction, PAYMENT_DIRECTION.PAID),
          isNull(supplierPayments.reversesId),
          isNull(supplierPayments.reversedAt),
          isNull(supplierPayments.deletedAt),
        ),
      )
      .orderBy(asc(supplierPayments.paidOn), asc(supplierPayments.createdAt));

    return rows
      .map((row) => ({ id: row.id, open: toMinorUnits(row.open) }))
      .filter((row) => row.open > 0);
  }

  async allocatePayment(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    supplierId: string,
    paymentId: string,
    amount: number,
    firstInvoiceId?: string,
  ): Promise<void> {
    const invoices = await this.openInvoices(tx, actor.clinicId, supplierId);
    const ordered = firstInvoiceId
      ? [
          ...invoices.filter((invoice) => invoice.id === firstInvoiceId),
          ...invoices.filter((invoice) => invoice.id !== firstInvoiceId),
        ]
      : invoices;
    let left = amount;

    for (const invoice of ordered) {
      if (left === 0) {
        break;
      }

      const taking = Math.min(left, invoice.open);
      await this.insert(tx, actor, paymentId, invoice.id, taking, null);
      left -= taking;
    }
  }

  async applyCredit(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    supplierId: string,
    invoiceId: string,
  ): Promise<void> {
    const [invoice] = (await this.openInvoices(tx, actor.clinicId, supplierId)).filter(
      (row) => row.id === invoiceId,
    );
    let left = invoice?.open ?? 0;

    for (const payment of await this.unallocatedPayments(tx, actor.clinicId, supplierId)) {
      if (left === 0) {
        break;
      }

      const taking = Math.min(left, payment.open);
      await this.insert(tx, actor, payment.id, invoiceId, taking, null);
      left -= taking;
    }
  }

  async reallocate(
    actor: AuthenticatedUser,
    paymentId: string,
    allocations: readonly { readonly invoiceId: string; readonly amount: string }[],
    reason: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(supplierPayments)
        .where(
          and(eq(supplierPayments.id, paymentId), eq(supplierPayments.clinicId, actor.clinicId)),
        )
        .limit(1);

      if (!payment || payment.reversesId !== null || payment.reversedAt !== null) {
        throw new NotFoundException("Resource not found");
      }

      await this.lockSupplier(tx, actor.clinicId, payment.supplierId);
      const before = await this.activeFor(tx, eq(supplierAllocations.paymentId, paymentId));
      await this.reverseWhere(tx, actor, eq(supplierAllocations.paymentId, paymentId), reason);

      const total = allocations.reduce((sum, row) => sum + toMinorUnits(row.amount), 0);

      if (total > toMinorUnits(payment.amount)) {
        throw new ConflictException(PURCHASE_ERROR.ALLOCATION_EXCEEDS);
      }

      const open = new Map(
        (await this.openInvoices(tx, actor.clinicId, payment.supplierId)).map((row) => [
          row.id,
          row.open,
        ]),
      );

      for (const row of allocations) {
        const amount = toMinorUnits(row.amount);

        if (amount <= 0) {
          continue;
        }
        if (amount > (open.get(row.invoiceId) ?? 0)) {
          throw new ConflictException(PURCHASE_ERROR.ALLOCATION_EXCEEDS);
        }

        await this.insert(tx, actor, paymentId, row.invoiceId, amount, reason);
        open.set(row.invoiceId, (open.get(row.invoiceId) ?? 0) - amount);
      }

      await this.audit.record(
        {
          clinicId: actor.clinicId,
          userId: actor.id,
          action: AUDIT_ACTION.UPDATE,
          entity: SUPPLIER_PAYMENTS_ENTITY,
          entityId: paymentId,
          oldValue: { allocations: before },
          newValue: { allocations, reason },
        },
        tx,
      );
    });
  }

  reverseForInvoice(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    invoiceId: string,
    reason: string,
  ): Promise<void> {
    return this.reverseWhere(tx, actor, eq(supplierAllocations.invoiceId, invoiceId), reason);
  }

  reverseForPayment(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    paymentId: string,
    reason: string,
  ): Promise<void> {
    return this.reverseWhere(tx, actor, eq(supplierAllocations.paymentId, paymentId), reason);
  }

  private async activeFor(tx: DatabaseExecutor, filter: ReturnType<typeof eq>) {
    const rows = await tx
      .select({ invoiceId: supplierAllocations.invoiceId, amount: supplierAllocations.amount })
      .from(supplierAllocations)
      .where(and(filter, active));

    return rows;
  }

  private async reverseWhere(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    filter: ReturnType<typeof eq>,
    reason: string,
  ): Promise<void> {
    const rows = await tx
      .select()
      .from(supplierAllocations)
      .where(and(eq(supplierAllocations.clinicId, actor.clinicId), filter, active))
      .for("update");

    for (const row of rows) {
      await tx
        .update(supplierAllocations)
        .set({ reversedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
        .where(eq(supplierAllocations.id, row.id));

      await tx.insert(supplierAllocations).values({
        clinicId: row.clinicId,
        paymentId: row.paymentId,
        invoiceId: row.invoiceId,
        amount: formatMinorUnits(-toMinorUnits(row.amount)),
        reason,
        reversesId: row.id,
        createdBy: actor.id,
        updatedBy: actor.id,
      });
    }
  }

  private async insert(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    paymentId: string,
    invoiceId: string,
    amount: number,
    reason: string | null,
  ): Promise<void> {
    await tx.insert(supplierAllocations).values({
      clinicId: actor.clinicId,
      paymentId,
      invoiceId,
      amount: formatMinorUnits(amount),
      reason,
      createdBy: actor.id,
      updatedBy: actor.id,
    });
  }
}
