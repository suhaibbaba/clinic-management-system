import { Inject, Injectable } from "@nestjs/common";
import {
  AUDIT_ACTION,
  PURCHASE_REVIEW_KIND,
  type MarkReviewedInput,
  type PurchaseReviewEntry,
} from "@clinic/shared";
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { toOptionalPersonName } from "@api/common/person-name";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { stockReceipts, supplierInvoices, suppliers, users } from "@api/database/schema";
import { AuditService } from "@api/modules/audit/services/audit.service";
import {
  STOCK_RECEIPTS_ENTITY,
  SUPPLIER_INVOICES_ENTITY,
} from "@api/common/constants/audit-entities";

@Injectable()
export class PurchaseReviewService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async pending(actor: AuthenticatedUser): Promise<PurchaseReviewEntry[]> {
    const [receipts, invoices] = await Promise.all([
      this.db
        .select({
          row: stockReceipts,
          supplierName: suppliers.name,
          createdByNameAr: users.nameAr,
          createdByNameEn: users.nameEn,
          lines: sql<number>`(select count(*)::int from stock_receipt_lines l where l.receipt_id = "stock_receipts"."id")`,
        })
        .from(stockReceipts)
        .leftJoin(suppliers, eq(suppliers.id, stockReceipts.supplierId))
        .leftJoin(users, eq(users.id, stockReceipts.createdBy))
        .where(
          and(
            eq(stockReceipts.clinicId, actor.clinicId),
            isNull(stockReceipts.reviewedAt),
            ne(stockReceipts.createdBy, actor.id),
          ),
        )
        .orderBy(desc(stockReceipts.createdAt))
        .limit(200),
      this.db
        .select({
          row: supplierInvoices,
          supplierName: suppliers.name,
          createdByNameAr: users.nameAr,
          createdByNameEn: users.nameEn,
          lines: sql<number>`(select count(*)::int from supplier_invoice_lines l where l.invoice_id = "supplier_invoices"."id")`,
        })
        .from(supplierInvoices)
        .leftJoin(suppliers, eq(suppliers.id, supplierInvoices.supplierId))
        .leftJoin(users, eq(users.id, supplierInvoices.createdBy))
        .where(
          and(
            eq(supplierInvoices.clinicId, actor.clinicId),
            isNull(supplierInvoices.reviewedAt),
            ne(supplierInvoices.createdBy, actor.id),
          ),
        )
        .orderBy(desc(supplierInvoices.createdAt))
        .limit(200),
    ]);

    return [
      ...receipts.map(({ row, supplierName, createdByNameAr, createdByNameEn, lines }) => ({
        kind: PURCHASE_REVIEW_KIND.RECEIPT,
        id: row.id,
        number: row.number,
        status: row.status,
        date: row.receivedOn,
        supplierName,
        supplierRef: null,
        total: null,
        lines,
        createdByName: toOptionalPersonName(createdByNameAr, createdByNameEn),
        createdAt: row.createdAt.toISOString(),
      })),
      ...invoices.map(({ row, supplierName, createdByNameAr, createdByNameEn, lines }) => ({
        kind: PURCHASE_REVIEW_KIND.INVOICE,
        id: row.id,
        number: row.number,
        status: row.status,
        date: row.invoiceDate,
        supplierName,
        supplierRef: row.supplierRef,
        total: row.total,
        lines,
        createdByName: toOptionalPersonName(createdByNameAr, createdByNameEn),
        createdAt: row.createdAt.toISOString(),
      })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async markReviewed(actor: AuthenticatedUser, input: MarkReviewedInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      const now = new Date();
      const receipts =
        input.receipts.length === 0
          ? []
          : await tx
              .update(stockReceipts)
              .set({ reviewedAt: now, reviewedBy: actor.id })
              .where(
                and(
                  eq(stockReceipts.clinicId, actor.clinicId),
                  inArray(stockReceipts.id, input.receipts),
                  isNull(stockReceipts.reviewedAt),
                ),
              )
              .returning({ id: stockReceipts.id });
      const invoices =
        input.invoices.length === 0
          ? []
          : await tx
              .update(supplierInvoices)
              .set({ reviewedAt: now, reviewedBy: actor.id })
              .where(
                and(
                  eq(supplierInvoices.clinicId, actor.clinicId),
                  inArray(supplierInvoices.id, input.invoices),
                  isNull(supplierInvoices.reviewedAt),
                ),
              )
              .returning({ id: supplierInvoices.id });

      for (const [entity, rows] of [
        [STOCK_RECEIPTS_ENTITY, receipts],
        [SUPPLIER_INVOICES_ENTITY, invoices],
      ] as const) {
        for (const row of rows) {
          await this.audit.record(
            {
              clinicId: actor.clinicId,
              userId: actor.id,
              action: AUDIT_ACTION.UPDATE,
              entity,
              entityId: row.id,
              oldValue: { reviewedAt: null },
              newValue: { reviewedAt: now.toISOString() },
            },
            tx,
          );
        }
      }
    });
  }
}
