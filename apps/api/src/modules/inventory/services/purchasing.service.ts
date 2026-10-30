import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  AUDIT_ACTION,
  DEFAULT_TIME_ZONE,
  MOVEMENT_TYPE,
  PURCHASE_BACKDATE_DAYS,
  PURCHASE_MAX_BACKDATE_DAYS,
  PURCHASE_DOCUMENT_STATUS,
  PURCHASE_ERROR,
  PURCHASE_REQUEST_ERROR,
  PURCHASE_REQUEST_STATUS,
  RECEIPT_KIND,
  RULE,
  STOCK_ERROR,
  SUPPLIER_DOCUMENT_KIND,
  InvoiceMathError,
  addDays,
  computeInvoice,
  formatMinorUnits,
  localDate,
  roundDiv,
  toMinorUnits,
  toThousandths,
  type CorrectPurchaseInput,
  type InvoiceReceiptsInput,
  type PostPurchaseInput,
  type PurchaseResult,
  type PurchaseStockInput,
  type StockMovement,
  type SupplierInvoiceSummary,
  type UninvoicedLine,
} from "@clinic/shared";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { AuditService } from "@api/modules/audit/services/audit.service";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database, type DatabaseExecutor } from "@api/database/database.module";
import {
  documentCounters,
  inventoryItems,
  purchaseRequestLines,
  purchaseRequests,
  payrollMonths,
  stockMovements,
  stockReceiptLines,
  stockReceipts,
  supplierInvoiceLines,
  supplierInvoices,
} from "@api/database/schema";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";
import { InventoryItemsService } from "@api/modules/inventory/services/inventory-items.service";
import { SuppliersService } from "@api/modules/inventory/services/suppliers.service";
import { StockLedgerService } from "@api/modules/inventory/services/stock-ledger.service";
import { SupplierAllocationsService } from "@api/modules/inventory/services/supplier-allocations.service";
import { SupplierPaymentsService } from "@api/modules/inventory/services/supplier-payments.service";
import { toMovement, type MovementRow } from "@api/modules/inventory/lib/stock-movements";
import { receiptLineError } from "@api/modules/inventory/lib/item-rules";
import { type Rights } from "@api/modules/inventory/lib/purchase-rights";
import { PackSizesService } from "@api/modules/inventory/services/pack-sizes.service";
import { baseUnits, basePrice, type ResolvedPack } from "@api/modules/inventory/lib/pack-sizes";
import {
  STOCK_RECEIPTS_ENTITY,
  SUPPLIER_INVOICES_ENTITY,
  SUPPLIER_PAYMENTS_ENTITY,
} from "@api/common/constants/audit-entities";
import { UNIQUE_VIOLATION } from "@api/common/constants/postgres-errors";
import { violatedConstraint } from "@api/common/lib/postgres-errors";
import {
  RECEIPT_REQUEST_INDEX,
  SUPPLIER_PAYMENT_CAPABILITY,
  SUPPLIER_REFERENCE_INDEX,
} from "@api/modules/inventory/constants";

type ReceiptRow = typeof stockReceipts.$inferSelect;
type InvoiceRow = typeof supplierInvoices.$inferSelect;

const today = (): string => localDate(new Date(), DEFAULT_TIME_ZONE);

@Injectable()
export class PurchasingService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly items: InventoryItemsService,
    private readonly suppliersService: SuppliersService,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
    private readonly ledger: StockLedgerService,
    private readonly allocations: SupplierAllocationsService,
    private readonly payments: SupplierPaymentsService,
    private readonly packSizes: PackSizesService,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(STOCK_RECEIPTS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(stockReceipts)
        .where(and(eq(stockReceipts.id, id), eq(stockReceipts.clinicId, clinicId)))
        .limit(1);

      return row ? { ...row } : null;
    });
    this.auditSnapshots.register(SUPPLIER_INVOICES_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(supplierInvoices)
        .where(and(eq(supplierInvoices.id, id), eq(supplierInvoices.clinicId, clinicId)))
        .limit(1);

      return row ? { ...row } : null;
    });
  }

  async post(actor: AuthenticatedUser, input: PostPurchaseInput): Promise<PurchaseResult> {
    if (input.requestId) {
      const earlier = await this.resultForRequest(actor.clinicId, input.requestId);

      if (earlier) {
        return earlier;
      }
    }

    await this.validatePost(actor, input);
    const rights = await this.rights(actor);
    const packs = await this.packSizes.resolve(actor.clinicId, input.lines);

    try {
      return await this.db.transaction((tx) => this.postWithin(tx, actor, input, rights, packs));
    } catch (error) {
      const constraint = violatedConstraint(error, UNIQUE_VIOLATION);

      if (constraint === RECEIPT_REQUEST_INDEX && input.requestId) {
        const replayed = await this.resultForRequest(actor.clinicId, input.requestId);

        if (replayed) {
          return replayed;
        }
      }
      if (constraint === SUPPLIER_REFERENCE_INDEX) {
        throw new ConflictException(PURCHASE_ERROR.DUPLICATE_REFERENCE);
      }

      throw error;
    }
  }

  async purchaseOne(actor: AuthenticatedUser, input: PurchaseStockInput): Promise<StockMovement> {
    const priced = input.unitPrice !== undefined;
    const result = await this.post(actor, {
      supplierId: input.supplierId ?? null,
      date: today(),
      lines: [
        {
          itemId: input.itemId,
          quantity: input.quantity,
          ...(priced && { unitPrice: input.unitPrice }),
          batchNo: input.batchNo ?? null,
          expiryDate: input.expiryDate ?? null,
        },
      ],
      invoice: priced && input.supplierId ? {} : null,
      ...(input.paidNow !== undefined && { paidNow: input.paidNow }),
      ...(input.paymentMethod !== undefined && { paymentMethod: input.paymentMethod }),
      note: input.reason ?? null,
      ...(input.requestId !== undefined && { requestId: input.requestId }),
    });

    const movement = await this.ledger.find(actor.clinicId, result.movementIds[0] ?? "");

    if (!movement) {
      throw new Error("Failed to read the purchase");
    }

    return toMovement(movement);
  }

  private async validatePost(actor: AuthenticatedUser, input: PostPurchaseInput): Promise<void> {
    if (input.supplierId) {
      await this.suppliersService.requireRow(actor.clinicId, input.supplierId);
    }
    for (const line of input.lines) {
      const problem = receiptLineError(
        await this.items.requireRow(actor.clinicId, line.itemId),
        line,
      );

      if (problem) {
        throw new BadRequestException(problem);
      }
    }
    if (input.paidNow && input.paymentMethod && input.supplierId) {
      await this.payments.validate(actor, input.supplierId, input.paymentMethod);
    }

    await this.assertReceivable(this.db, actor.clinicId, input.lines);
  }

  private async assertReceivable(
    tx: DatabaseExecutor,
    clinicId: string,
    lines: readonly { readonly itemId: string; readonly requestLineId?: string | undefined }[],
  ): Promise<void> {
    const wanted = lines.filter((line) => line.requestLineId !== undefined);

    if (wanted.length === 0) {
      return;
    }

    const rows = await tx
      .select({ line: purchaseRequestLines, status: purchaseRequests.status })
      .from(purchaseRequestLines)
      .innerJoin(purchaseRequests, eq(purchaseRequests.id, purchaseRequestLines.requestId))
      .where(
        and(
          eq(purchaseRequestLines.clinicId, clinicId),
          inArray(
            purchaseRequestLines.id,
            wanted.map((line) => line.requestLineId ?? ""),
          ),
        ),
      );

    for (const line of wanted) {
      const found = rows.find((row) => row.line.id === line.requestLineId);

      if (
        !found ||
        found.line.removedAt !== null ||
        found.line.itemId !== line.itemId ||
        (found.status !== PURCHASE_REQUEST_STATUS.REQUESTED &&
          found.status !== PURCHASE_REQUEST_STATUS.ORDERED)
      ) {
        throw new BadRequestException(PURCHASE_REQUEST_ERROR.WRONG_LINE);
      }
    }
  }

  async rights(actor: AuthenticatedUser): Promise<Rights> {
    const [seesCosts, mayPay, mayBackdate, mayReversePriced] = await Promise.all([
      this.permissions.can(actor, RULE.INVENTORY_COSTS),
      this.permissions.can(actor, SUPPLIER_PAYMENT_CAPABILITY),
      this.permissions.can(actor, RULE.BACKDATE_PURCHASES),
      this.permissions.can(actor, RULE.REVERSE_PRICED_PURCHASE),
    ]);

    return { seesCosts, mayPay, mayBackdate, mayReversePriced };
  }

  private async postWithin(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    input: PostPurchaseInput,
    rights: Rights,
    packs: ReadonlyMap<number, ResolvedPack>,
  ): Promise<PurchaseResult> {
    const priced = input.lines.some((line) => line.unitPrice !== undefined);

    if ((priced || input.invoice || input.paidNow) && !rights.seesCosts) {
      throw new ForbiddenException("Purchase prices are not available to this role");
    }
    if (input.paidNow && !rights.mayPay) {
      throw new ForbiddenException("Recording a supplier payment is not allowed");
    }
    if (input.invoice && input.lines.some((line) => !line.gift && line.unitPrice === undefined)) {
      throw new BadRequestException(PURCHASE_ERROR.MISSING_PRICE);
    }

    await this.assertDate(tx, actor, input.date, rights.mayBackdate);

    const invoice = input.invoice
      ? this.compute(
          input.lines.map((line) => ({
            quantity: line.quantity,
            freeQuantity: line.freeQuantity,
            unitPrice: line.unitPrice ?? "0",
            discount: line.discount,
            gift: line.gift,
          })),
          input.invoice,
        )
      : null;

    if (input.paidNow && invoice && toMinorUnits(input.paidNow) > toMinorUnits(invoice.total)) {
      throw new BadRequestException("A payment at purchase cannot exceed the purchase total");
    }
    if (input.invoice?.supplierRef && input.supplierId) {
      await this.assertReferenceFree(
        tx,
        actor.clinicId,
        input.supplierId,
        input.invoice.supplierRef,
      );
    }

    await this.ledger.lockItems(
      tx,
      actor.clinicId,
      input.lines.map((line) => line.itemId),
    );

    const receipt = await this.insertReceipt(tx, actor, {
      kind: RECEIPT_KIND.RECEIPT,
      supplierId: input.supplierId ?? null,
      date: input.date,
      note: input.note ?? null,
      requestId: input.requestId ?? null,
    });

    const lineIds: string[] = [];
    const movementIds: string[] = [];

    for (const [index, line] of input.lines.entries()) {
      const lineId = randomUUID();
      const pack = packs.get(index);
      const units = baseUnits(
        toThousandths(line.quantity) + toThousandths(line.freeQuantity ?? "0"),
        pack,
      );
      const cost = invoice?.lines[index]?.cost;
      const value =
        cost !== undefined
          ? toMinorUnits(cost)
          : line.unitPrice !== undefined
            ? roundDiv(toThousandths(line.quantity) * toMinorUnits(line.unitPrice), 1000)
            : 0;
      const known = cost !== undefined || line.unitPrice !== undefined;

      const movement = await this.ledger.insert(tx, actor, {
        itemId: line.itemId,
        type: MOVEMENT_TYPE.PURCHASE,
        quantity: units,
        value,
        unknown: known ? 0 : units,
        unitPrice: line.unitPrice === undefined ? null : basePrice(line.unitPrice, pack),
        supplierId: input.supplierId ?? null,
        batchNo: line.batchNo ?? null,
        expiryDate: line.expiryDate ?? null,
        reason: input.note ?? null,
        receiptLineId: lineId,
        occurredOn: input.date,
      });

      await tx.insert(stockReceiptLines).values({
        id: lineId,
        clinicId: actor.clinicId,
        receiptId: receipt.id,
        itemId: line.itemId,
        quantity: line.quantity,
        freeQuantity: line.freeQuantity ?? "0",
        unitPrice: line.unitPrice ?? null,
        purchaseUnit: pack?.unit ?? null,
        unitsPerPurchaseUnit: pack?.unitsPer ?? "1",
        batchNo: line.batchNo ?? null,
        expiryDate: line.expiryDate ?? null,
        requestLineId: line.requestLineId ?? null,
        movementId: movement.id,
      });

      lineIds.push(lineId);
      movementIds.push(movement.id);
    }

    let invoiceRow: InvoiceRow | null = null;
    let paymentId: string | null = null;

    if (invoice && input.invoice && input.supplierId) {
      invoiceRow = await this.insertInvoice(tx, actor, {
        supplierId: input.supplierId,
        date: input.date,
        terms: input.invoice,
        note: input.note ?? null,
        totals: invoice,
      });

      for (const [index, line] of input.lines.entries()) {
        const computed = invoice.lines[index];

        if (!computed) {
          continue;
        }

        await tx.insert(supplierInvoiceLines).values({
          clinicId: actor.clinicId,
          invoiceId: invoiceRow.id,
          receiptLineId: lineIds[index] ?? "",
          itemId: line.itemId,
          quantity: line.quantity,
          freeQuantity: line.freeQuantity ?? "0",
          unitPrice: line.unitPrice ?? "0",
          discountKind: line.discount?.kind ?? null,
          discountValue: line.discount?.value ?? null,
          gift: line.gift ?? false,
          gross: computed.gross,
          lineDiscount: computed.lineDiscount,
          net: computed.net,
          allocation: computed.allocation,
          cost: computed.cost,
        });
      }

      await this.allocations.lockSupplier(tx, actor.clinicId, input.supplierId);

      if (input.paidNow && input.paymentMethod && toMinorUnits(input.paidNow) > 0) {
        const payment = await this.payments.create(
          actor,
          {
            supplierId: input.supplierId,
            amount: input.paidNow,
            method: input.paymentMethod,
            paidOn: input.date,
          },
          tx,
          movementIds[0] ?? null,
        );

        paymentId = payment.id;
        await this.allocations.allocatePayment(
          tx,
          actor,
          input.supplierId,
          payment.id,
          toMinorUnits(payment.amount),
          invoiceRow.id,
        );
        await this.audit.record(
          {
            clinicId: actor.clinicId,
            userId: actor.id,
            action: AUDIT_ACTION.CREATE,
            entity: SUPPLIER_PAYMENTS_ENTITY,
            entityId: payment.id,
            oldValue: null,
            newValue: { ...payment },
          },
          tx,
        );
      }

      if (input.invoice.applyCredit !== false) {
        await this.allocations.applyCredit(tx, actor, input.supplierId, invoiceRow.id);
      }
    }

    return {
      receiptId: receipt.id,
      receiptNumber: receipt.number,
      invoiceId: invoiceRow?.id ?? null,
      invoiceNumber: invoiceRow?.number ?? null,
      total: invoiceRow?.total ?? null,
      paymentId,
      movementIds,
    };
  }

  async invoiceReceipts(
    actor: AuthenticatedUser,
    input: InvoiceReceiptsInput,
  ): Promise<SupplierInvoiceSummary> {
    const rights = await this.rights(actor);

    if (!rights.seesCosts) {
      throw new ForbiddenException("Purchase prices are not available to this role");
    }

    try {
      await this.suppliersService.requireRow(actor.clinicId, input.supplierId);

      return await this.db.transaction(async (tx) => {
        await this.assertDate(tx, actor, input.date, rights.mayBackdate);

        if (input.supplierRef) {
          await this.assertReferenceFree(tx, actor.clinicId, input.supplierId, input.supplierRef);
        }

        const lines = await tx
          .select({ line: stockReceiptLines, receipt: stockReceipts, movement: stockMovements })
          .from(stockReceiptLines)
          .innerJoin(stockReceipts, eq(stockReceipts.id, stockReceiptLines.receiptId))
          .innerJoin(stockMovements, eq(stockMovements.id, stockReceiptLines.movementId))
          .where(
            and(
              eq(stockReceiptLines.clinicId, actor.clinicId),
              inArray(
                stockReceiptLines.id,
                input.lines.map((line) => line.receiptLineId),
              ),
            ),
          )
          .for("update", { of: stockReceiptLines });

        if (lines.length !== input.lines.length) {
          throw new NotFoundException("Resource not found");
        }
        for (const { receipt } of lines) {
          if (
            receipt.kind !== RECEIPT_KIND.RECEIPT ||
            receipt.status !== PURCHASE_DOCUMENT_STATUS.POSTED ||
            receipt.supplierId !== input.supplierId
          ) {
            throw new BadRequestException(PURCHASE_ERROR.VOID_DOCUMENT);
          }
        }

        const billed = await tx
          .select({ id: supplierInvoiceLines.receiptLineId })
          .from(supplierInvoiceLines)
          .innerJoin(supplierInvoices, eq(supplierInvoices.id, supplierInvoiceLines.invoiceId))
          .where(
            and(
              inArray(
                supplierInvoiceLines.receiptLineId,
                lines.map(({ line }) => line.id),
              ),
              eq(supplierInvoices.status, PURCHASE_DOCUMENT_STATUS.POSTED),
              eq(supplierInvoices.kind, SUPPLIER_DOCUMENT_KIND.INVOICE),
            ),
          );

        if (billed.length > 0) {
          throw new ConflictException(PURCHASE_ERROR.ALREADY_INVOICED);
        }

        const ordered = input.lines.map((wanted) => {
          const found = lines.find(({ line }) => line.id === wanted.receiptLineId);

          if (!found) {
            throw new NotFoundException("Resource not found");
          }

          return { ...found, wanted };
        });

        const totals = this.compute(
          ordered.map(({ line, wanted }) => ({
            quantity: line.quantity,
            freeQuantity: line.freeQuantity,
            unitPrice: wanted.unitPrice,
            discount: wanted.discount,
            gift: wanted.gift,
          })),
          input,
        );

        await this.ledger.lockItems(
          tx,
          actor.clinicId,
          ordered.map(({ line }) => line.itemId),
        );

        const invoice = await this.insertInvoice(tx, actor, {
          supplierId: input.supplierId,
          date: input.date,
          terms: input,
          note: input.note ?? null,
          totals,
        });

        for (const [index, { line, movement, wanted }] of ordered.entries()) {
          const computed = totals.lines[index];

          if (!computed) {
            continue;
          }

          const variance = await this.settleProvisionalCost(
            tx,
            actor,
            line.id,
            line.itemId,
            movement,
            toMinorUnits(computed.cost),
            invoice.number,
          );

          await tx.insert(supplierInvoiceLines).values({
            clinicId: actor.clinicId,
            invoiceId: invoice.id,
            receiptLineId: line.id,
            itemId: line.itemId,
            quantity: line.quantity,
            freeQuantity: line.freeQuantity,
            unitPrice: wanted.unitPrice,
            discountKind: wanted.discount?.kind ?? null,
            discountValue: wanted.discount?.value ?? null,
            gift: wanted.gift ?? false,
            gross: computed.gross,
            lineDiscount: computed.lineDiscount,
            net: computed.net,
            allocation: computed.allocation,
            cost: computed.cost,
            variance: formatMinorUnits(variance),
          });
        }

        await this.allocations.lockSupplier(tx, actor.clinicId, input.supplierId);

        if (input.applyCredit !== false) {
          await this.allocations.applyCredit(tx, actor, input.supplierId, invoice.id);
        }

        return this.summarise(tx, invoice);
      });
    } catch (error) {
      if (violatedConstraint(error, UNIQUE_VIOLATION) === SUPPLIER_REFERENCE_INDEX) {
        throw new ConflictException(PURCHASE_ERROR.DUPLICATE_REFERENCE);
      }

      throw error;
    }
  }

  async voidInvoice(actor: AuthenticatedUser, id: string, reason: string): Promise<void> {
    await this.db.transaction((tx) => this.voidInvoiceWithin(tx, actor, id, reason));
  }

  async voidReceipt(actor: AuthenticatedUser, id: string, reason: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const receipt = await this.lockReceipt(tx, actor.clinicId, id);
      await this.voidReceiptWithin(tx, actor, receipt, reason, true);
    });
  }

  async voidPurchaseMovement(
    actor: AuthenticatedUser,
    movement: MovementRow,
    reason: string,
  ): Promise<StockMovement> {
    const rights = await this.rights(actor);

    return this.db.transaction(async (tx) => {
      const receipt = await this.receiptOfMovement(tx, actor, movement);
      const reversal = await this.voidSingleLine(
        tx,
        actor,
        receipt,
        movement,
        reason,
        true,
        rights,
      );

      return toMovement(reversal);
    });
  }

  async correctPurchaseMovement(
    actor: AuthenticatedUser,
    id: string,
    input: CorrectPurchaseInput,
  ): Promise<StockMovement> {
    const rights = await this.rights(actor);

    if (!rights.mayReversePriced) {
      const original = await this.ledger.find(actor.clinicId, id);

      if (!original || original.unitPrice !== null || input.unitPrice !== undefined) {
        throw new ForbiddenException("Only a manager can edit a priced purchase");
      }
    }

    const before = await this.ledger.find(actor.clinicId, id);

    if (before?.supplierId) {
      await this.suppliersService.requireRow(actor.clinicId, before.supplierId);
    }

    const movementId = await this.db.transaction(async (tx) => {
      const original = await this.ledger.find(actor.clinicId, id, tx);

      if (!original || original.reversedAt !== null || original.reversesId !== null) {
        throw new BadRequestException("This movement has already been reversed");
      }
      if (original.type !== MOVEMENT_TYPE.PURCHASE) {
        throw new BadRequestException("Only a purchase can be corrected");
      }

      const receipt = await this.receiptOfMovement(tx, actor, original);

      await this.ledger.lockItems(tx, actor.clinicId, [original.itemId]);
      const { onHand } = await this.ledger.layers(tx, actor.clinicId, original.itemId);

      if (onHand - toThousandths(original.quantity) + toThousandths(input.quantity) < 0) {
        throw new ConflictException(STOCK_ERROR.INSUFFICIENT);
      }

      await this.voidSingleLine(tx, actor, receipt, original, input.reason, false, rights);

      const result = await this.postWithin(
        tx,
        actor,
        {
          supplierId: original.supplierId,
          date: today(),
          lines: [
            {
              itemId: original.itemId,
              quantity: input.quantity,
              ...(input.unitPrice !== undefined && { unitPrice: input.unitPrice }),
              batchNo: original.batchNo,
              expiryDate: original.expiryDate,
            },
          ],
          invoice: input.unitPrice !== undefined && original.supplierId ? {} : null,
          note: input.reason,
        },
        rights,
        new Map(),
      );

      return result.movementIds[0] ?? "";
    });

    const movement = await this.ledger.find(actor.clinicId, movementId);

    if (!movement) {
      throw new Error("Failed to read the corrected purchase");
    }

    return toMovement(movement);
  }

  async uninvoiced(actor: AuthenticatedUser, supplierId: string): Promise<UninvoicedLine[]> {
    await this.suppliersService.requireRow(actor.clinicId, supplierId);
    await this.suppliersService.assertSeesCosts(actor);

    const rows = await this.db
      .select({
        line: stockReceiptLines,
        receiptNumber: stockReceipts.number,
        receivedOn: stockReceipts.receivedOn,
        itemName: inventoryItems.name,
        unit: inventoryItems.unit,
      })
      .from(stockReceiptLines)
      .innerJoin(stockReceipts, eq(stockReceipts.id, stockReceiptLines.receiptId))
      .innerJoin(inventoryItems, eq(inventoryItems.id, stockReceiptLines.itemId))
      .where(
        and(
          eq(stockReceipts.clinicId, actor.clinicId),
          eq(stockReceipts.supplierId, supplierId),
          eq(stockReceipts.kind, RECEIPT_KIND.RECEIPT),
          eq(stockReceipts.status, PURCHASE_DOCUMENT_STATUS.POSTED),
          sql`not exists (
            select 1 from supplier_invoice_lines il
            join supplier_invoices i on i.id = il.invoice_id
            where il.receipt_line_id = "stock_receipt_lines"."id" and i.status = 'posted'
              and i.kind = 'invoice'
          )`,
        ),
      )
      .orderBy(asc(stockReceipts.receivedOn), asc(stockReceipts.number));

    return rows.map((row) => ({
      receiptLineId: row.line.id,
      receiptNumber: row.receiptNumber,
      receivedOn: row.receivedOn,
      itemId: row.line.itemId,
      itemName: row.itemName,
      unit: row.line.purchaseUnit ?? row.unit,
      quantity: row.line.quantity,
      freeQuantity: row.line.freeQuantity,
      unitPrice: row.line.unitPrice,
    }));
  }

  async listInvoices(
    actor: AuthenticatedUser,
    supplierId: string,
  ): Promise<SupplierInvoiceSummary[]> {
    await this.suppliersService.requireRow(actor.clinicId, supplierId);
    await this.suppliersService.assertSeesCosts(actor);

    const rows = await this.db
      .select()
      .from(supplierInvoices)
      .where(
        and(
          eq(supplierInvoices.clinicId, actor.clinicId),
          eq(supplierInvoices.supplierId, supplierId),
        ),
      )
      .orderBy(sql`${supplierInvoices.invoiceDate} desc`, sql`${supplierInvoices.number} desc`);

    return Promise.all(rows.map((row) => this.summarise(this.db, row)));
  }

  async summarise(tx: DatabaseExecutor, row: InvoiceRow): Promise<SupplierInvoiceSummary> {
    const [paid] = await tx
      .select({
        amount: sql<string>`coalesce(sum(amount), 0)::text`,
      })
      .from(sql`supplier_allocations`)
      .where(
        row.kind === SUPPLIER_DOCUMENT_KIND.CREDIT_NOTE
          ? sql`credit_id = ${row.id} and reverses_id is null and reversed_at is null`
          : sql`invoice_id = ${row.id} and reverses_id is null and reversed_at is null`,
      );
    const allocated = toMinorUnits(paid?.amount ?? "0");

    return {
      id: row.id,
      kind: row.kind,
      number: row.number,
      supplierRef: row.supplierRef,
      invoiceDate: row.invoiceDate,
      status: row.status,
      total: row.total,
      paid: formatMinorUnits(allocated),
      open: formatMinorUnits(
        row.status === PURCHASE_DOCUMENT_STATUS.VOID ? 0 : toMinorUnits(row.total) - allocated,
      ),
    };
  }

  private async settleProvisionalCost(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    receiptLineId: string,
    itemId: string,
    movement: MovementRow,
    cost: number,
    reference: string,
  ): Promise<number> {
    const units = toThousandths(movement.quantity);
    const layers = await this.ledger.layers(tx, actor.clinicId, itemId);
    const unknown = toThousandths(movement.unknownQuantity);
    let value: number;
    let converted = 0;

    if (unknown === 0) {
      const diff = cost - toMinorUnits(movement.value);
      value = roundDiv(diff * Math.min(Math.max(layers.onHand, 0), units), units);
    } else {
      converted = Math.min(units, Math.max(layers.unknown, 0));
      value = roundDiv(cost * converted, units);
    }

    if (value !== 0 || converted !== 0) {
      await this.ledger.insert(tx, actor, {
        itemId,
        type: MOVEMENT_TYPE.ADJUST,
        quantity: 0,
        value,
        unknown: -converted,
        receiptLineId,
        reason: reference,
      });
    }

    return unknown === 0 ? cost - toMinorUnits(movement.value) - value : cost - value;
  }

  async voidInvoiceWithin(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    id: string,
    reason: string,
  ): Promise<void> {
    const [invoice] = await tx
      .select()
      .from(supplierInvoices)
      .where(and(eq(supplierInvoices.id, id), eq(supplierInvoices.clinicId, actor.clinicId)))
      .for("update");

    if (!invoice) {
      throw new NotFoundException("Resource not found");
    }
    if (invoice.status !== PURCHASE_DOCUMENT_STATUS.POSTED) {
      throw new BadRequestException(PURCHASE_ERROR.VOID_DOCUMENT);
    }

    await this.assertMonthOpen(tx, actor.clinicId, invoice.invoiceDate);
    await this.allocations.lockSupplier(tx, actor.clinicId, invoice.supplierId);
    await (invoice.kind === SUPPLIER_DOCUMENT_KIND.CREDIT_NOTE
      ? this.allocations.reverseForCredit(tx, actor, invoice.id, reason)
      : this.allocations.reverseForInvoice(tx, actor, invoice.id, reason));

    const lines = await tx
      .select({ receiptLineId: supplierInvoiceLines.receiptLineId })
      .from(supplierInvoiceLines)
      .where(eq(supplierInvoiceLines.invoiceId, invoice.id));
    const adjustments = await tx
      .select()
      .from(stockMovements)
      .where(
        and(
          inArray(
            stockMovements.receiptLineId,
            lines.map((line) => line.receiptLineId),
          ),
          eq(stockMovements.type, MOVEMENT_TYPE.ADJUST),
          eq(stockMovements.quantity, "0"),
          eq(stockMovements.reason, invoice.number),
          isNull(stockMovements.reversesId),
          isNull(stockMovements.reversedAt),
        ),
      );

    for (const adjustment of adjustments) {
      await this.ledger.reverse(tx, actor, adjustment, reason);
    }

    await tx
      .update(supplierInvoices)
      .set({
        status: PURCHASE_DOCUMENT_STATUS.VOID,
        voidReason: reason,
        voidedAt: new Date(),
        voidedBy: actor.id,
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(eq(supplierInvoices.id, invoice.id));

    await this.audit.record(
      {
        clinicId: actor.clinicId,
        userId: actor.id,
        action: AUDIT_ACTION.UPDATE,
        entity: SUPPLIER_INVOICES_ENTITY,
        entityId: invoice.id,
        oldValue: { status: invoice.status },
        newValue: { status: PURCHASE_DOCUMENT_STATUS.VOID, reason },
      },
      tx,
    );
  }

  async voidReceiptWithin(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    receipt: ReceiptRow,
    reason: string,
    checkStock: boolean,
  ): Promise<MovementRow[]> {
    if (receipt.status !== PURCHASE_DOCUMENT_STATUS.POSTED) {
      throw new BadRequestException(PURCHASE_ERROR.VOID_DOCUMENT);
    }

    await this.assertMonthOpen(tx, actor.clinicId, receipt.receivedOn);

    const lines = await tx
      .select()
      .from(stockReceiptLines)
      .where(eq(stockReceiptLines.receiptId, receipt.id));
    const billed = await tx
      .select({ id: supplierInvoiceLines.id })
      .from(supplierInvoiceLines)
      .innerJoin(supplierInvoices, eq(supplierInvoices.id, supplierInvoiceLines.invoiceId))
      .where(
        and(
          inArray(
            supplierInvoiceLines.receiptLineId,
            lines.map((line) => line.id),
          ),
          eq(supplierInvoices.status, PURCHASE_DOCUMENT_STATUS.POSTED),
        ),
      );

    if (billed.length > 0) {
      throw new ConflictException(PURCHASE_ERROR.INVOICED_RECEIPT);
    }

    await this.ledger.lockItems(
      tx,
      actor.clinicId,
      lines.map((line) => line.itemId),
    );

    const reversals: MovementRow[] = [];

    for (const line of lines) {
      const movement = line.movementId
        ? await this.ledger.find(actor.clinicId, line.movementId, tx)
        : undefined;

      if (!movement || movement.reversedAt !== null) {
        continue;
      }

      if (checkStock) {
        const { onHand } = await this.ledger.layers(tx, actor.clinicId, line.itemId);

        if (toThousandths(movement.quantity) > onHand) {
          throw new ConflictException(STOCK_ERROR.INSUFFICIENT);
        }
      }

      reversals.push(await this.ledger.reverse(tx, actor, movement, reason));
    }

    await tx
      .update(stockReceipts)
      .set({
        status: PURCHASE_DOCUMENT_STATUS.VOID,
        voidReason: reason,
        voidedAt: new Date(),
        voidedBy: actor.id,
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(eq(stockReceipts.id, receipt.id));

    await this.audit.record(
      {
        clinicId: actor.clinicId,
        userId: actor.id,
        action: AUDIT_ACTION.UPDATE,
        entity: STOCK_RECEIPTS_ENTITY,
        entityId: receipt.id,
        oldValue: { status: receipt.status },
        newValue: { status: PURCHASE_DOCUMENT_STATUS.VOID, reason },
      },
      tx,
    );

    return reversals;
  }

  private async voidSingleLine(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    receipt: ReceiptRow,
    movement: MovementRow,
    reason: string,
    checkStock: boolean,
    rights: Rights,
  ): Promise<MovementRow> {
    if (movement.unitPrice !== null && !rights.mayReversePriced) {
      throw new ForbiddenException("Only a manager can reverse a priced purchase");
    }

    const lines = await tx
      .select({ id: stockReceiptLines.id })
      .from(stockReceiptLines)
      .where(eq(stockReceiptLines.receiptId, receipt.id));

    if (lines.length !== 1) {
      throw new ConflictException(PURCHASE_ERROR.VOID_DOCUMENT);
    }

    const invoices = await tx
      .selectDistinct({ id: supplierInvoices.id })
      .from(supplierInvoiceLines)
      .innerJoin(supplierInvoices, eq(supplierInvoices.id, supplierInvoiceLines.invoiceId))
      .where(
        and(
          eq(supplierInvoiceLines.receiptLineId, lines[0]?.id ?? ""),
          eq(supplierInvoices.status, PURCHASE_DOCUMENT_STATUS.POSTED),
        ),
      );

    for (const invoice of invoices) {
      const [count] = await tx
        .select({ value: sql<number>`count(*)::int` })
        .from(supplierInvoiceLines)
        .where(eq(supplierInvoiceLines.invoiceId, invoice.id));

      if ((count?.value ?? 0) !== 1) {
        throw new ConflictException(PURCHASE_ERROR.VOID_DOCUMENT);
      }

      await this.voidInvoiceWithin(tx, actor, invoice.id, reason);
    }

    const [reversal] = await this.voidReceiptWithin(tx, actor, receipt, reason, checkStock);

    if (!reversal) {
      throw new Error("Failed to reverse the purchase");
    }

    return reversal;
  }

  private async receiptOfMovement(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    movement: MovementRow,
  ): Promise<ReceiptRow> {
    const [line] = await tx
      .select({ receiptId: stockReceiptLines.receiptId })
      .from(stockReceiptLines)
      .where(eq(stockReceiptLines.id, movement.receiptLineId ?? ""))
      .limit(1);

    if (!line) {
      throw new NotFoundException("Resource not found");
    }

    return this.lockReceipt(tx, actor.clinicId, line.receiptId);
  }

  async lockReceipt(tx: DatabaseExecutor, clinicId: string, id: string): Promise<ReceiptRow> {
    const [receipt] = await tx
      .select()
      .from(stockReceipts)
      .where(and(eq(stockReceipts.id, id), eq(stockReceipts.clinicId, clinicId)))
      .for("update");

    if (!receipt) {
      throw new NotFoundException("Resource not found");
    }

    return receipt;
  }

  private compute(
    lines: Parameters<typeof computeInvoice>[0]["lines"],
    terms: {
      discount?: { kind: "percent" | "amount"; value: string } | undefined;
      charges?: string | undefined;
    },
  ) {
    try {
      return computeInvoice({ lines, discount: terms.discount, charges: terms.charges });
    } catch (error) {
      if (error instanceof InvoiceMathError) {
        throw new BadRequestException(error.code);
      }

      throw error;
    }
  }

  async insertReceipt(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    values: {
      kind: (typeof RECEIPT_KIND)[keyof typeof RECEIPT_KIND];
      supplierId: string | null;
      date: string;
      note: string | null;
      requestId: string | null;
    },
  ): Promise<ReceiptRow> {
    const number = await this.nextNumber(
      tx,
      actor.clinicId,
      { [RECEIPT_KIND.OPENING]: "OS", [RECEIPT_KIND.RETURN]: "RT", [RECEIPT_KIND.RECEIPT]: "GR" }[
        values.kind
      ],
      values.date,
    );
    const [row] = await tx
      .insert(stockReceipts)
      .values({
        clinicId: actor.clinicId,
        number,
        kind: values.kind,
        supplierId: values.supplierId,
        receivedOn: values.date,
        note: values.note,
        requestId: values.requestId,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to record the receipt");
    }

    await this.audit.record(
      {
        clinicId: actor.clinicId,
        userId: actor.id,
        action: AUDIT_ACTION.CREATE,
        entity: STOCK_RECEIPTS_ENTITY,
        entityId: row.id,
        oldValue: null,
        newValue: { ...row },
      },
      tx,
    );

    return row;
  }

  async insertInvoice(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    values: {
      supplierId: string;
      date: string;
      terms: {
        supplierRef?: string | null | undefined;
        discount?: { kind: string; value: string } | undefined;
        taxRate?: string | undefined;
        taxAmount?: string | undefined;
      };
      note: string | null;
      totals: ReturnType<typeof computeInvoice>;
    },
  ): Promise<InvoiceRow> {
    const number = await this.nextNumber(tx, actor.clinicId, "PI", values.date);
    const [row] = await tx
      .insert(supplierInvoices)
      .values({
        clinicId: actor.clinicId,
        number,
        supplierId: values.supplierId,
        supplierRef: values.terms.supplierRef ?? null,
        invoiceDate: values.date,
        discountKind: values.terms.discount?.kind ?? null,
        discountValue: values.terms.discount?.value ?? null,
        charges: values.totals.charges,
        taxRate: values.terms.taxRate ?? null,
        taxAmount: values.terms.taxAmount ?? null,
        subtotal: values.totals.subtotal,
        invoiceDiscount: values.totals.invoiceDiscount,
        total: values.totals.total,
        note: values.note,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to record the invoice");
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

  async nextNumber(
    tx: DatabaseExecutor,
    clinicId: string,
    kind: string,
    date: string,
  ): Promise<string> {
    const year = Number(date.slice(0, 4));
    const [row] = await tx
      .insert(documentCounters)
      .values({ clinicId, kind, year, last: 1 })
      .onConflictDoUpdate({
        target: [documentCounters.clinicId, documentCounters.kind, documentCounters.year],
        set: { last: sql`${documentCounters.last} + 1` },
      })
      .returning({ last: documentCounters.last });

    return `${kind}-${year}-${String(row?.last ?? 1).padStart(4, "0")}`;
  }

  async assertDate(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    date: string,
    mayBackdate: boolean,
  ): Promise<void> {
    const now = today();

    if (date > now) {
      throw new BadRequestException(PURCHASE_ERROR.FUTURE_DATE);
    }
    if (date < addDays(now, -PURCHASE_MAX_BACKDATE_DAYS)) {
      throw new BadRequestException(PURCHASE_ERROR.TOO_OLD);
    }
    if (date < addDays(now, -PURCHASE_BACKDATE_DAYS) && !mayBackdate) {
      throw new ForbiddenException(PURCHASE_ERROR.BACKDATE_NOT_ALLOWED);
    }

    await this.assertMonthOpen(tx, actor.clinicId, date);
  }

  async assertMonthOpen(tx: DatabaseExecutor, clinicId: string, date: string): Promise<void> {
    const [closed] = await tx
      .select({ id: payrollMonths.id })
      .from(payrollMonths)
      .where(
        and(
          eq(payrollMonths.clinicId, clinicId),
          eq(payrollMonths.month, `${date.slice(0, 7)}-01`),
        ),
      )
      .limit(1);

    if (closed) {
      throw new ConflictException(PURCHASE_ERROR.CLOSED_MONTH);
    }
  }

  async assertReferenceFree(
    tx: DatabaseExecutor,
    clinicId: string,
    supplierId: string,
    reference: string,
  ): Promise<void> {
    const [clash] = await tx
      .select({ id: supplierInvoices.id })
      .from(supplierInvoices)
      .where(
        and(
          eq(supplierInvoices.clinicId, clinicId),
          eq(supplierInvoices.supplierId, supplierId),
          eq(supplierInvoices.status, PURCHASE_DOCUMENT_STATUS.POSTED),
          sql`lower(${supplierInvoices.supplierRef}) = lower(${reference})`,
        ),
      )
      .limit(1);

    if (clash) {
      throw new ConflictException(PURCHASE_ERROR.DUPLICATE_REFERENCE);
    }
  }

  private async resultForRequest(
    clinicId: string,
    requestId: string,
  ): Promise<PurchaseResult | undefined> {
    const [receipt] = await this.db
      .select()
      .from(stockReceipts)
      .where(and(eq(stockReceipts.clinicId, clinicId), eq(stockReceipts.requestId, requestId)))
      .limit(1);

    if (!receipt) {
      return undefined;
    }

    const lines = await this.db
      .select({ id: stockReceiptLines.id, movementId: stockReceiptLines.movementId })
      .from(stockReceiptLines)
      .where(eq(stockReceiptLines.receiptId, receipt.id))
      .orderBy(asc(stockReceiptLines.createdAt));
    const [invoice] = lines[0]
      ? await this.db
          .select({ invoice: supplierInvoices })
          .from(supplierInvoiceLines)
          .innerJoin(supplierInvoices, eq(supplierInvoices.id, supplierInvoiceLines.invoiceId))
          .where(eq(supplierInvoiceLines.receiptLineId, lines[0].id))
          .limit(1)
      : [];

    return {
      receiptId: receipt.id,
      receiptNumber: receipt.number,
      invoiceId: invoice?.invoice.id ?? null,
      invoiceNumber: invoice?.invoice.number ?? null,
      total: invoice?.invoice.total ?? null,
      paymentId: null,
      movementIds: lines.map((line) => line.movementId ?? "").filter((id) => id !== ""),
    };
  }
}
