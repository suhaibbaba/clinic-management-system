import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  AUDIT_ACTION,
  MOVEMENT_TYPE,
  PURCHASE_DOCUMENT_STATUS,
  PURCHASE_ERROR,
  RECEIPT_KIND,
  STOCK_ERROR,
  SUPPLIER_DOCUMENT_KIND,
  formatMinorUnits,
  formatThousandths,
  roundDiv,
  toMinorUnits,
  toThousandths,
  type PriceDocumentInput,
  type SupplierDocumentKind,
  type SupplierInvoiceSummary,
  type SupplierReturnInput,
  type SupplierReturnResult,
} from "@clinic/shared";
import { and, eq, inArray, ne } from "drizzle-orm";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database, type DatabaseExecutor } from "@api/database/database.module";
import {
  stockMovements,
  stockReceiptLines,
  stockReceipts,
  supplierInvoiceLines,
  supplierInvoices,
} from "@api/database/schema";
import { AuditService } from "@api/modules/audit/services/audit.service";
import { InventoryItemsService } from "@api/modules/inventory/services/inventory-items.service";
import { PurchasingService } from "@api/modules/inventory/services/purchasing.service";
import { StockLedgerService } from "@api/modules/inventory/services/stock-ledger.service";
import { StockService } from "@api/modules/inventory/services/stock.service";
import { SuppliersService } from "@api/modules/inventory/services/suppliers.service";
import { SupplierAllocationsService } from "@api/modules/inventory/services/supplier-allocations.service";
import { costOut } from "@api/modules/inventory/lib/costing";
import { wholeUnitError } from "@api/modules/inventory/lib/item-rules";
import { fefoSlices, namedSlices } from "@api/modules/inventory/lib/stock";
import { SUPPLIER_INVOICES_ENTITY } from "@api/common/constants/audit-entities";

type InvoiceRow = typeof supplierInvoices.$inferSelect;

interface PricedLine {
  readonly receiptLineId: string;
  readonly itemId: string;
  readonly quantity: string;
  readonly freeQuantity: string;
  readonly amount: number;
  readonly stockPart: number;
}

@Injectable()
export class SupplierCreditsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly items: InventoryItemsService,
    private readonly suppliersService: SuppliersService,
    private readonly purchasing: PurchasingService,
    private readonly ledger: StockLedgerService,
    private readonly stock: StockService,
    private readonly allocations: SupplierAllocationsService,
    private readonly audit: AuditService,
  ) {}

  async returnToSupplier(
    actor: AuthenticatedUser,
    input: SupplierReturnInput,
  ): Promise<SupplierReturnResult> {
    const rights = await this.purchasing.rights(actor);

    if (input.credit && !(rights.seesCosts && rights.mayReversePriced)) {
      throw new ForbiddenException("Only a manager can record a supplier credit");
    }
    if (input.requestId) {
      const earlier = await this.returnForRequest(
        actor.clinicId,
        input.requestId,
        rights.seesCosts,
      );

      if (earlier) {
        return earlier;
      }
    }

    await this.suppliersService.requireRow(actor.clinicId, input.supplierId);

    for (const line of input.lines) {
      const fraction = wholeUnitError(
        await this.items.requireRow(actor.clinicId, line.itemId),
        line.quantity,
      );

      if (fraction) {
        throw new BadRequestException(fraction);
      }
    }

    const result = await this.db.transaction(async (tx) => {
      await this.purchasing.assertDate(tx, actor, input.date, rights.mayBackdate);
      await this.ledger.lockItems(
        tx,
        actor.clinicId,
        input.lines.map((line) => line.itemId),
      );

      const receipt = await this.purchasing.insertReceipt(tx, actor, {
        kind: RECEIPT_KIND.RETURN,
        supplierId: input.supplierId,
        date: input.date,
        note: input.note ?? null,
        requestId: input.requestId ?? null,
      });
      const returned: {
        readonly lineId: string;
        readonly itemId: string;
        readonly quantity: string;
        readonly value: number;
      }[] = [];

      for (const line of input.lines) {
        const wanted = toThousandths(line.quantity);
        const layers = await this.ledger.layers(tx, actor.clinicId, line.itemId);

        if (wanted > layers.onHand) {
          throw new ConflictException(STOCK_ERROR.INSUFFICIENT);
        }

        const { batches } = await this.stock.forItem(
          actor.clinicId,
          line.itemId,
          0,
          new Date(),
          tx,
        );
        const unusable = batches
          .filter((batch) => batch.isExpired || batch.blockId !== null)
          .reduce((total, batch) => total + toThousandths(batch.remaining), 0);

        if (!line.batchNo && wanted > layers.onHand - unusable) {
          throw new ConflictException(STOCK_ERROR.EXPIRED);
        }

        const slices = line.batchNo
          ? namedSlices(batches, wanted, line.batchNo)
          : fefoSlices(batches, wanted);

        if (!slices) {
          throw new ConflictException(STOCK_ERROR.INSUFFICIENT);
        }

        for (const slice of slices) {
          const lineId = randomUUID();
          const cost = costOut(
            await this.ledger.layers(tx, actor.clinicId, line.itemId),
            slice.thousandths,
          );
          const quantity = formatThousandths(slice.thousandths);
          const movement = await this.ledger.insert(tx, actor, {
            itemId: line.itemId,
            type: MOVEMENT_TYPE.RETURN,
            quantity: -slice.thousandths,
            value: cost.value,
            unknown: cost.unknown,
            supplierId: input.supplierId,
            batchNo: slice.batchNo,
            reason: input.note ?? null,
            receiptLineId: lineId,
            occurredOn: input.date,
          });

          await tx.insert(stockReceiptLines).values({
            id: lineId,
            clinicId: actor.clinicId,
            receiptId: receipt.id,
            itemId: line.itemId,
            quantity,
            batchNo: slice.batchNo,
            movementId: movement.id,
          });

          returned.push({ lineId, itemId: line.itemId, quantity, value: -cost.value });
        }
      }

      const value = returned.reduce((total, line) => total + line.value, 0);
      let credit: InvoiceRow | null = null;

      if (input.credit) {
        const amount = toMinorUnits(input.credit.amount);

        if (input.credit.supplierRef) {
          await this.purchasing.assertReferenceFree(
            tx,
            actor.clinicId,
            input.supplierId,
            input.credit.supplierRef,
          );
        }

        credit = await this.insertDocument(tx, actor, {
          kind: SUPPLIER_DOCUMENT_KIND.CREDIT_NOTE,
          supplierId: input.supplierId,
          date: input.date,
          supplierRef: input.credit.supplierRef ?? null,
          creditsInvoiceId: null,
          total: amount,
          variance: amount - value,
          note: input.note ?? null,
          requestId: null,
        });

        for (const line of returned) {
          await tx.insert(supplierInvoiceLines).values({
            clinicId: actor.clinicId,
            invoiceId: credit.id,
            receiptLineId: line.lineId,
            itemId: line.itemId,
            quantity: line.quantity,
            unitPrice: "0",
            gross: "0",
            net: "0",
            cost: formatMinorUnits(line.value),
          });
        }

        await this.allocations.lockSupplier(tx, actor.clinicId, input.supplierId);
        await this.allocations.allocateCredit(tx, actor, input.supplierId, credit.id, amount);
      }

      return {
        returnId: receipt.id,
        returnNumber: receipt.number,
        value: formatMinorUnits(value),
        creditNoteId: credit?.id ?? null,
        creditNoteNumber: credit?.number ?? null,
      };
    });

    return rights.seesCosts ? result : { ...result, value: undefined };
  }

  async voidReturn(actor: AuthenticatedUser, id: string, reason: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const receipt = await this.purchasing.lockReceipt(tx, actor.clinicId, id);

      if (receipt.kind !== RECEIPT_KIND.RETURN) {
        throw new NotFoundException("Resource not found");
      }

      const credits = await tx
        .selectDistinct({ id: supplierInvoices.id })
        .from(supplierInvoiceLines)
        .innerJoin(supplierInvoices, eq(supplierInvoices.id, supplierInvoiceLines.invoiceId))
        .innerJoin(stockReceiptLines, eq(stockReceiptLines.id, supplierInvoiceLines.receiptLineId))
        .where(
          and(
            eq(stockReceiptLines.receiptId, receipt.id),
            eq(supplierInvoices.status, PURCHASE_DOCUMENT_STATUS.POSTED),
          ),
        );

      for (const credit of credits) {
        await this.purchasing.voidInvoiceWithin(tx, actor, credit.id, reason);
      }

      await this.purchasing.voidReceiptWithin(tx, actor, receipt, reason, false);
    });
  }

  creditNote(actor: AuthenticatedUser, input: PriceDocumentInput): Promise<SupplierInvoiceSummary> {
    return this.priceDocument(actor, input, SUPPLIER_DOCUMENT_KIND.CREDIT_NOTE);
  }

  supplementary(
    actor: AuthenticatedUser,
    input: PriceDocumentInput,
  ): Promise<SupplierInvoiceSummary> {
    return this.priceDocument(actor, input, SUPPLIER_DOCUMENT_KIND.SUPPLEMENTARY);
  }

  private async priceDocument(
    actor: AuthenticatedUser,
    input: PriceDocumentInput,
    kind: SupplierDocumentKind,
  ): Promise<SupplierInvoiceSummary> {
    const rights = await this.purchasing.rights(actor);

    if (!rights.seesCosts) {
      throw new ForbiddenException("Purchase prices are not available to this role");
    }
    if (input.requestId) {
      const [earlier] = await this.db
        .select()
        .from(supplierInvoices)
        .where(
          and(
            eq(supplierInvoices.clinicId, actor.clinicId),
            eq(supplierInvoices.requestId, input.requestId),
          ),
        )
        .limit(1);

      if (earlier) {
        return this.purchasing.summarise(this.db, earlier);
      }
    }

    await this.suppliersService.requireRow(actor.clinicId, input.supplierId);

    const lineTotal = (input.lines ?? []).reduce(
      (total, line) => total + toMinorUnits(line.amount),
      0,
    );
    const total = input.lines?.length ? lineTotal : toMinorUnits(input.amount ?? "0");

    if (input.amount !== undefined && input.lines?.length && toMinorUnits(input.amount) !== total) {
      throw new BadRequestException(PURCHASE_ERROR.CREDIT_EXCEEDS);
    }

    return this.db.transaction(async (tx) => {
      await this.purchasing.assertDate(tx, actor, input.date, rights.mayBackdate);

      if (input.supplierRef) {
        await this.purchasing.assertReferenceFree(
          tx,
          actor.clinicId,
          input.supplierId,
          input.supplierRef,
        );
      }
      if (input.invoiceId) {
        await this.requireInvoice(tx, actor.clinicId, input.supplierId, input.invoiceId);
      }

      const lines = await this.pricedLines(tx, actor, input, kind);
      const stockPart = lines.reduce((sum, line) => sum + line.stockPart, 0);
      const document = await this.insertDocument(tx, actor, {
        kind,
        supplierId: input.supplierId,
        date: input.date,
        supplierRef: input.supplierRef ?? null,
        creditsInvoiceId: input.invoiceId ?? null,
        total,
        variance: total - stockPart,
        note: input.note ?? null,
        requestId: input.requestId ?? null,
      });
      const sign = kind === SUPPLIER_DOCUMENT_KIND.CREDIT_NOTE ? -1 : 1;

      for (const line of lines) {
        if (line.stockPart !== 0) {
          await this.ledger.insert(tx, actor, {
            itemId: line.itemId,
            type: MOVEMENT_TYPE.ADJUST,
            quantity: 0,
            value: sign * line.stockPart,
            unknown: 0,
            receiptLineId: line.receiptLineId,
            reason: document.number,
          });
        }

        await tx.insert(supplierInvoiceLines).values({
          clinicId: actor.clinicId,
          invoiceId: document.id,
          receiptLineId: line.receiptLineId,
          itemId: line.itemId,
          quantity: line.quantity,
          freeQuantity: line.freeQuantity,
          unitPrice: "0",
          gross: formatMinorUnits(line.amount),
          net: formatMinorUnits(line.amount),
          cost: formatMinorUnits(line.stockPart),
          variance: formatMinorUnits(line.amount - line.stockPart),
        });
      }

      await this.allocations.lockSupplier(tx, actor.clinicId, input.supplierId);

      if (kind === SUPPLIER_DOCUMENT_KIND.CREDIT_NOTE) {
        await this.allocations.allocateCredit(
          tx,
          actor,
          input.supplierId,
          document.id,
          total,
          input.invoiceId ?? null,
        );
      } else {
        await this.allocations.applyCredit(tx, actor, input.supplierId, document.id);
      }

      return this.purchasing.summarise(tx, document);
    });
  }

  private async pricedLines(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    input: PriceDocumentInput,
    kind: SupplierDocumentKind,
  ): Promise<PricedLine[]> {
    const wanted = input.lines ?? [];

    if (wanted.length === 0) {
      return [];
    }

    const rows = await tx
      .select({ line: stockReceiptLines, receipt: stockReceipts, movement: stockMovements })
      .from(stockReceiptLines)
      .innerJoin(stockReceipts, eq(stockReceipts.id, stockReceiptLines.receiptId))
      .innerJoin(stockMovements, eq(stockMovements.id, stockReceiptLines.movementId))
      .where(
        and(
          eq(stockReceiptLines.clinicId, actor.clinicId),
          inArray(
            stockReceiptLines.id,
            wanted.map((line) => line.receiptLineId),
          ),
        ),
      );

    await this.ledger.lockItems(
      tx,
      actor.clinicId,
      rows.map(({ line }) => line.itemId),
    );

    const priced: PricedLine[] = [];

    for (const request of wanted) {
      const found = rows.find(({ line }) => line.id === request.receiptLineId);

      if (
        !found ||
        found.receipt.kind !== RECEIPT_KIND.RECEIPT ||
        found.receipt.status !== PURCHASE_DOCUMENT_STATUS.POSTED ||
        found.receipt.supplierId !== input.supplierId
      ) {
        throw new NotFoundException("Resource not found");
      }

      const amount = toMinorUnits(request.amount);
      const units = toThousandths(found.movement.quantity);
      const layers = await this.ledger.layers(tx, actor.clinicId, found.line.itemId);
      const share = roundDiv(amount * Math.min(Math.max(layers.onHand, 0), units), units);
      const stockPart =
        kind === SUPPLIER_DOCUMENT_KIND.CREDIT_NOTE
          ? Math.min(share, Math.max(layers.knownValue, 0))
          : share;

      priced.push({
        receiptLineId: found.line.id,
        itemId: found.line.itemId,
        quantity: found.line.quantity,
        freeQuantity: found.line.freeQuantity,
        amount,
        stockPart,
      });
    }

    return priced;
  }

  private async requireInvoice(
    tx: DatabaseExecutor,
    clinicId: string,
    supplierId: string,
    invoiceId: string,
  ): Promise<void> {
    const [invoice] = await tx
      .select({ id: supplierInvoices.id })
      .from(supplierInvoices)
      .where(
        and(
          eq(supplierInvoices.id, invoiceId),
          eq(supplierInvoices.clinicId, clinicId),
          eq(supplierInvoices.supplierId, supplierId),
          eq(supplierInvoices.status, PURCHASE_DOCUMENT_STATUS.POSTED),
          ne(supplierInvoices.kind, SUPPLIER_DOCUMENT_KIND.CREDIT_NOTE),
        ),
      )
      .limit(1);

    if (!invoice) {
      throw new NotFoundException("Resource not found");
    }
  }

  private async insertDocument(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    values: {
      readonly kind: SupplierDocumentKind;
      readonly supplierId: string;
      readonly date: string;
      readonly supplierRef: string | null;
      readonly creditsInvoiceId: string | null;
      readonly total: number;
      readonly variance: number;
      readonly note: string | null;
      readonly requestId: string | null;
    },
  ): Promise<InvoiceRow> {
    const number = await this.purchasing.nextNumber(
      tx,
      actor.clinicId,
      values.kind === SUPPLIER_DOCUMENT_KIND.CREDIT_NOTE ? "CN" : "SI",
      values.date,
    );
    const total = formatMinorUnits(values.total);
    const [row] = await tx
      .insert(supplierInvoices)
      .values({
        clinicId: actor.clinicId,
        number,
        kind: values.kind,
        supplierId: values.supplierId,
        supplierRef: values.supplierRef,
        creditsInvoiceId: values.creditsInvoiceId,
        invoiceDate: values.date,
        subtotal: total,
        total,
        variance: formatMinorUnits(values.variance),
        note: values.note,
        requestId: values.requestId,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to record the supplier document");
    }

    await this.audit.record(
      {
        clinicId: actor.clinicId,
        userId: actor.id,
        action: AUDIT_ACTION.CREATE,
        entity: SUPPLIER_INVOICES_ENTITY,
        entityId: row.id,
        oldValue: null,
        newValue: { ...row },
      },
      tx,
    );

    return row;
  }

  private async returnForRequest(
    clinicId: string,
    requestId: string,
    seesCosts: boolean,
  ): Promise<SupplierReturnResult | undefined> {
    const [receipt] = await this.db
      .select()
      .from(stockReceipts)
      .where(and(eq(stockReceipts.clinicId, clinicId), eq(stockReceipts.requestId, requestId)))
      .limit(1);

    if (!receipt) {
      return undefined;
    }

    const [credit] = await this.db
      .select({ id: supplierInvoices.id, number: supplierInvoices.number })
      .from(supplierInvoiceLines)
      .innerJoin(supplierInvoices, eq(supplierInvoices.id, supplierInvoiceLines.invoiceId))
      .innerJoin(stockReceiptLines, eq(stockReceiptLines.id, supplierInvoiceLines.receiptLineId))
      .where(eq(stockReceiptLines.receiptId, receipt.id))
      .limit(1);
    const moved = await this.db
      .select({ value: stockMovements.value })
      .from(stockMovements)
      .innerJoin(stockReceiptLines, eq(stockReceiptLines.movementId, stockMovements.id))
      .where(eq(stockReceiptLines.receiptId, receipt.id));
    const value = -moved.reduce((total, row) => total + toMinorUnits(row.value), 0);

    return {
      returnId: receipt.id,
      returnNumber: receipt.number,
      ...(seesCosts && { value: formatMinorUnits(value) }),
      creditNoteId: credit?.id ?? null,
      creditNoteNumber: credit?.number ?? null,
    };
  }
}
