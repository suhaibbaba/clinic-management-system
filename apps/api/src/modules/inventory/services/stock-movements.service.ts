import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import {
  AUDIT_ACTION,
  MOVEMENT_TYPE,
  RULE,
  STOCK_ERROR,
  toMinorUnits,
  formatThousandths,
  negateQuantity,
  toThousandths,
  type AdjustStockInput,
  type ConsumeStockInput,
  type CorrectPurchaseInput,
  type ItemBatch,
  type ListMovementsQuery,
  type MovementType,
  type Paginated,
  type PurchaseStockInput,
  type ReverseMovementInput,
  type StockMovement,
  type StockMovementRow,
} from "@clinic/shared";
import { and, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { toOptionalPersonName } from "@api/common/person-name";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database, type DatabaseExecutor } from "@api/database/database.module";
import {
  inventoryItems,
  patients,
  performedProcedures,
  procedureCatalog,
  stockMovements,
  suppliers,
  users,
} from "@api/database/schema";
import { InventoryItemsService } from "@api/modules/inventory/services/inventory-items.service";
import { fefoSlices, normalise } from "@api/modules/inventory/lib/stock";
import { SuppliersService } from "@api/modules/inventory/services/suppliers.service";
import {
  STOCK_MOVEMENTS_ENTITY,
  SUPPLIER_PAYMENTS_ENTITY,
} from "@api/common/constants/audit-entities";
import { toMovement, withoutCost } from "@api/modules/inventory/lib/stock-movements";
import { lineTotal } from "@api/modules/inventory/lib/inventory-reports";
import {
  STOCK_MOVEMENTS_REQUEST_INDEX,
  SUPPLIER_PAYMENT_CAPABILITY,
} from "@api/modules/inventory/constants";
import { StockService } from "@api/modules/inventory/services/stock.service";
import { UNIQUE_VIOLATION } from "@api/common/constants/postgres-errors";
import { violatedConstraint } from "@api/common/lib/postgres-errors";
import { SupplierPaymentsService } from "@api/modules/inventory/services/supplier-payments.service";
import { AuditService } from "@api/modules/audit/services/audit.service";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";

@Injectable()
export class StockMovementsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly items: InventoryItemsService,
    private readonly suppliersService: SuppliersService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
    private readonly supplierPayments: SupplierPaymentsService,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditService,
    private readonly stock: StockService,
  ) {}

  seesCosts(actor: AuthenticatedUser): Promise<boolean> {
    return this.permissions.can(actor, RULE.INVENTORY_COSTS);
  }

  onModuleInit(): void {
    this.auditSnapshots.register(STOCK_MOVEMENTS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(stockMovements)
        .where(and(eq(stockMovements.id, id), eq(stockMovements.clinicId, clinicId)))
        .limit(1);

      return row ? { ...toMovement(row) } : null;
    });
  }

  async list(
    actor: AuthenticatedUser,
    query: ListMovementsQuery,
  ): Promise<Paginated<StockMovementRow>> {
    const filters: (SQL | undefined)[] = [];

    if (query.itemId) {
      await this.items.requireRow(actor.clinicId, query.itemId);
      filters.push(eq(stockMovements.itemId, query.itemId));
    }
    if (query.type) {
      filters.push(eq(stockMovements.type, query.type));
    }
    if (query.supplierId) {
      filters.push(eq(stockMovements.supplierId, query.supplierId));
    }
    if (query.patientId) {
      filters.push(eq(stockMovements.patientId, query.patientId));
    }
    if (query.from) {
      filters.push(gte(stockMovements.createdAt, new Date(query.from)));
    }
    if (query.to) {
      filters.push(lt(stockMovements.createdAt, new Date(query.to)));
    }

    const where = and(eq(stockMovements.clinicId, actor.clinicId), ...filters);
    const { limit, offset } = toLimitOffset(query);

    const ledger = this.db
      .select({
        id: stockMovements.id,
        runningQuantity: sql<string>`sum(${stockMovements.quantity}) over (
          partition by ${stockMovements.itemId}
          order by ${stockMovements.createdAt} asc, ${stockMovements.id} asc
          rows between unbounded preceding and current row
        )::text`.as("running_quantity"),
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.clinicId, actor.clinicId),
          query.itemId ? eq(stockMovements.itemId, query.itemId) : undefined,
        ),
      )
      .as("ledger");

    const [rows, [totals]] = await Promise.all([
      this.db
        .select({
          movement: stockMovements,
          supplierName: suppliers.name,
          patientName: patients.fullName,
          procedureName: procedureCatalog.name,
          createdByNameAr: users.nameAr,
          createdByNameEn: users.nameEn,
          runningQuantity: ledger.runningQuantity,
        })
        .from(stockMovements)
        .innerJoin(ledger, eq(ledger.id, stockMovements.id))
        .leftJoin(suppliers, eq(suppliers.id, stockMovements.supplierId))
        .leftJoin(patients, eq(patients.id, stockMovements.patientId))
        .leftJoin(
          performedProcedures,
          eq(performedProcedures.id, stockMovements.performedProcedureId),
        )
        .leftJoin(procedureCatalog, eq(procedureCatalog.id, performedProcedures.procedureId))
        .leftJoin(users, eq(users.id, stockMovements.createdBy))
        .where(where)
        .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(stockMovements)
        .where(where),
    ]);

    const seesCosts = await this.seesCosts(actor);

    return toPaginated(
      rows.map((row) => ({
        ...withoutCost(toMovement(row.movement), seesCosts),
        supplierName: row.supplierName,
        patientName: row.patientName,
        procedureName: row.procedureName,
        createdByName: toOptionalPersonName(row.createdByNameAr, row.createdByNameEn),
        runningQuantity: normalise(row.runningQuantity),
      })),
      totals?.value ?? 0,
      query,
    );
  }

  async purchase(actor: AuthenticatedUser, input: PurchaseStockInput): Promise<StockMovement> {
    return this.once(actor, input.requestId, () => this.recordPurchase(actor, input));
  }

  private async recordPurchase(
    actor: AuthenticatedUser,
    input: PurchaseStockInput,
  ): Promise<StockMovement> {
    await this.items.requireRow(actor.clinicId, input.itemId);

    if (
      (input.unitPrice !== undefined || input.paidNow !== undefined) &&
      !(await this.seesCosts(actor))
    ) {
      throw new ForbiddenException("Purchase prices are not available to this role");
    }

    if (input.supplierId) {
      await this.suppliersService.requireRow(actor.clinicId, input.supplierId);
    }

    const paidNow = input.paidNow && toMinorUnits(input.paidNow) > 0 ? input.paidNow : null;

    if (paidNow !== null) {
      if (!(await this.permissions.can(actor, SUPPLIER_PAYMENT_CAPABILITY))) {
        throw new ForbiddenException("Recording a supplier payment is not allowed");
      }
      if (
        input.unitPrice === undefined ||
        toMinorUnits(paidNow) > toMinorUnits(lineTotal(input.quantity, input.unitPrice))
      ) {
        throw new BadRequestException("A payment at purchase cannot exceed the purchase total");
      }
    }

    return this.db.transaction(async (tx) => {
      await this.lockItem(tx, actor.clinicId, input.itemId);

      const movement = await this.write(
        actor,
        {
          itemId: input.itemId,
          type: MOVEMENT_TYPE.PURCHASE,
          quantity: input.quantity,
          unitPrice: input.unitPrice ?? null,
          supplierId: input.supplierId ?? null,
          batchNo: input.batchNo ?? null,
          expiryDate: input.expiryDate ?? null,
          reason: input.reason ?? null,
          requestId: input.requestId ?? null,
        },
        tx,
      );

      if (paidNow !== null && input.supplierId && input.paymentMethod) {
        const payment = await this.supplierPayments.create(
          actor,
          { supplierId: input.supplierId, amount: paidNow, method: input.paymentMethod },
          tx,
          movement.id,
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

      return movement;
    });
  }

  async consume(actor: AuthenticatedUser, input: ConsumeStockInput): Promise<StockMovement> {
    return this.once(actor, input.requestId, () => this.recordUse(actor, input));
  }

  private async recordUse(
    actor: AuthenticatedUser,
    input: ConsumeStockInput,
  ): Promise<StockMovement> {
    await this.items.requireRow(actor.clinicId, input.itemId);

    let patientId = input.patientId ?? null;

    if (input.performedProcedureId) {
      const [procedure] = await this.db
        .select({ id: performedProcedures.id, patientId: performedProcedures.patientId })
        .from(performedProcedures)
        .where(
          this.scope.where(
            performedProcedures,
            actor.clinicId,
            eq(performedProcedures.id, input.performedProcedureId),
          ),
        )
        .limit(1);

      if (!procedure) {
        throw new NotFoundException("Resource not found");
      }

      patientId = procedure.patientId;
    } else if (patientId) {
      await this.scope.findOneOrFail(patients, actor.clinicId, patientId);
    }

    return this.db.transaction(async (tx) => {
      await this.lockItem(tx, actor.clinicId, input.itemId);

      const batches = await this.assertUsable(
        tx,
        actor.clinicId,
        input.itemId,
        input.quantity,
        input.batchNo,
      );
      const slices = input.batchNo
        ? [{ batchNo: input.batchNo, thousandths: toThousandths(input.quantity) }]
        : fefoSlices(batches, toThousandths(input.quantity));

      const written: StockMovement[] = [];

      for (const [index, slice] of slices.entries()) {
        written.push(
          await this.write(
            actor,
            {
              itemId: input.itemId,
              type: MOVEMENT_TYPE.CONSUME,
              quantity: formatThousandths(-slice.thousandths),
              patientId,
              performedProcedureId: input.performedProcedureId ?? null,
              batchNo: slice.batchNo,
              reason: input.reason ?? null,
              requestId: index === 0 ? (input.requestId ?? null) : null,
            },
            tx,
          ),
        );
      }

      const [first, ...rest] = written;

      if (!first) {
        throw new Error("Failed to record the use");
      }

      return rest.length === 0 ? first : { ...first, quantity: negateQuantity(input.quantity) };
    });
  }

  async adjust(actor: AuthenticatedUser, input: AdjustStockInput): Promise<StockMovement> {
    return this.once(actor, input.requestId, () => this.recordAdjustment(actor, input));
  }

  private async recordAdjustment(
    actor: AuthenticatedUser,
    input: AdjustStockInput,
  ): Promise<StockMovement> {
    await this.items.requireRow(actor.clinicId, input.itemId);

    if (toThousandths(input.quantity) === 0) {
      throw new BadRequestException("An adjustment cannot be zero");
    }
    if (input.quantity.startsWith("-") && toThousandths(input.quantity.slice(1)) < 1000) {
      throw new BadRequestException(STOCK_ERROR.BELOW_ONE);
    }

    return this.db.transaction(async (tx) => {
      if (input.quantity.startsWith("-")) {
        await this.lockItem(tx, actor.clinicId, input.itemId);
        await this.assertOnHand(tx, actor.clinicId, input.itemId, input.quantity.slice(1));
      }

      return this.write(
        actor,
        {
          itemId: input.itemId,
          type: MOVEMENT_TYPE.ADJUST,
          quantity: input.quantity,
          reason: input.reason,
          batchNo: input.batchNo ?? null,
          expiryDate: input.expiryDate ?? null,
          requestId: input.requestId ?? null,
        },
        tx,
      );
    });
  }

  private async once(
    actor: AuthenticatedUser,
    requestId: string | undefined,
    record: () => Promise<StockMovement>,
  ): Promise<StockMovement> {
    return withoutCost(await this.replayOr(actor, requestId, record), await this.seesCosts(actor));
  }

  private async replayOr(
    actor: AuthenticatedUser,
    requestId: string | undefined,
    record: () => Promise<StockMovement>,
  ): Promise<StockMovement> {
    if (requestId === undefined) {
      return record();
    }

    const earlier = await this.byRequest(actor.clinicId, requestId);

    if (earlier) {
      return earlier;
    }

    try {
      return await record();
    } catch (error) {
      const replayed =
        violatedConstraint(error, UNIQUE_VIOLATION) === STOCK_MOVEMENTS_REQUEST_INDEX
          ? await this.byRequest(actor.clinicId, requestId)
          : undefined;

      if (replayed) {
        return replayed;
      }

      throw error;
    }
  }

  private async byRequest(clinicId: string, requestId: string): Promise<StockMovement | undefined> {
    const [row] = await this.db
      .select()
      .from(stockMovements)
      .where(and(eq(stockMovements.clinicId, clinicId), eq(stockMovements.requestId, requestId)))
      .limit(1);

    return row ? toMovement(row) : undefined;
  }

  private async lockItem(tx: DatabaseExecutor, clinicId: string, itemId: string): Promise<void> {
    const [item] = await tx
      .select({ id: inventoryItems.id })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.clinicId, clinicId)))
      .for("update");

    if (!item) {
      throw new NotFoundException("Resource not found");
    }
  }

  private async onHand(tx: DatabaseExecutor, clinicId: string, itemId: string): Promise<number> {
    const [stock] = await tx
      .select({ onHand: sql<string>`coalesce(sum(${stockMovements.quantity}), 0)::text` })
      .from(stockMovements)
      .where(and(eq(stockMovements.clinicId, clinicId), eq(stockMovements.itemId, itemId)));

    return toThousandths(stock?.onHand ?? "0");
  }

  private async assertOnHand(
    tx: DatabaseExecutor,
    clinicId: string,
    itemId: string,
    taking: string,
  ): Promise<void> {
    if (toThousandths(taking) > (await this.onHand(tx, clinicId, itemId))) {
      throw new ConflictException(STOCK_ERROR.INSUFFICIENT);
    }
  }

  private async assertUsable(
    tx: DatabaseExecutor,
    clinicId: string,
    itemId: string,
    taking: string,
    batchNo: string | null | undefined,
  ): Promise<ItemBatch[]> {
    const onHand = await this.onHand(tx, clinicId, itemId);
    const wanted = toThousandths(taking);

    if (wanted > onHand) {
      throw new ConflictException(STOCK_ERROR.INSUFFICIENT);
    }

    const { batches } = await this.stock.forItem(clinicId, itemId, 0, new Date(), tx);
    const named = batchNo ? batches.find((batch) => batch.batchNo === batchNo) : undefined;
    const expired = batches
      .filter((batch) => batch.isExpired)
      .reduce((total, batch) => total + toThousandths(batch.remaining), 0);

    if (named?.isExpired || wanted > onHand - expired) {
      throw new ConflictException(STOCK_ERROR.EXPIRED);
    }

    return batches;
  }

  async reverse(
    actor: AuthenticatedUser,
    id: string,
    input: ReverseMovementInput,
  ): Promise<StockMovement> {
    const seesCosts = await this.seesCosts(actor);

    return withoutCost(await this.reverseLocked(actor, id, input), seesCosts);
  }

  private async reverseLocked(
    actor: AuthenticatedUser,
    id: string,
    input: ReverseMovementInput,
  ): Promise<StockMovement> {
    return this.db.transaction(async (tx) => {
      const original = await this.lockOpen(tx, actor, id);

      await this.assertMayReverse(actor, original);
      await this.lockItem(tx, actor.clinicId, original.itemId);

      if (toThousandths(original.quantity) > 0) {
        await this.assertOnHand(tx, actor.clinicId, original.itemId, normalise(original.quantity));
      }

      return this.reverseWithin(tx, actor, original, input.reason);
    });
  }

  private async assertMayReverse(
    actor: AuthenticatedUser,
    original: typeof stockMovements.$inferSelect,
  ): Promise<void> {
    if (
      original.type === MOVEMENT_TYPE.PURCHASE &&
      original.unitPrice !== null &&
      !(await this.permissions.can(actor, RULE.REVERSE_PRICED_PURCHASE))
    ) {
      throw new ForbiddenException("Only a manager can reverse a priced purchase");
    }
  }

  async correctPurchase(
    actor: AuthenticatedUser,
    id: string,
    input: CorrectPurchaseInput,
  ): Promise<StockMovement> {
    const seesCosts = await this.seesCosts(actor);

    return withoutCost(await this.correctLocked(actor, id, input), seesCosts);
  }

  private async correctLocked(
    actor: AuthenticatedUser,
    id: string,
    input: CorrectPurchaseInput,
  ): Promise<StockMovement> {
    return this.db.transaction(async (tx) => {
      const original = await this.lockOpen(tx, actor, id);

      if (original.type !== MOVEMENT_TYPE.PURCHASE) {
        throw new BadRequestException("Only a purchase can be corrected");
      }

      await this.assertMayReverse(actor, original);

      if (input.unitPrice !== undefined && !(await this.seesCosts(actor))) {
        throw new ForbiddenException("Purchase prices are not available to this role");
      }

      await this.lockItem(tx, actor.clinicId, original.itemId);

      const left =
        (await this.onHand(tx, actor.clinicId, original.itemId)) -
        toThousandths(original.quantity) +
        toThousandths(input.quantity);

      if (left < 0) {
        throw new ConflictException(STOCK_ERROR.INSUFFICIENT);
      }

      await this.reverseWithin(tx, actor, original, input.reason);

      return this.write(
        actor,
        {
          itemId: original.itemId,
          type: MOVEMENT_TYPE.PURCHASE,
          quantity: input.quantity,
          unitPrice: input.unitPrice ?? null,
          supplierId: original.supplierId,
          batchNo: original.batchNo,
          expiryDate: original.expiryDate,
          reason: input.reason,
        },
        tx,
      );
    });
  }

  private async lockOpen(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    id: string,
  ): Promise<typeof stockMovements.$inferSelect> {
    const [original] = await tx
      .select()
      .from(stockMovements)
      .where(and(eq(stockMovements.id, id), eq(stockMovements.clinicId, actor.clinicId)))
      .limit(1)
      .for("update");

    if (!original) {
      throw new NotFoundException("Resource not found");
    }
    if (original.reversesId !== null) {
      throw new BadRequestException("A reversing entry cannot itself be reversed");
    }
    if (original.reversedAt !== null) {
      throw new BadRequestException("This movement has already been reversed");
    }

    return original;
  }

  private async reverseWithin(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    original: typeof stockMovements.$inferSelect,
    reason: string,
  ): Promise<StockMovement> {
    await tx
      .update(stockMovements)
      .set({ reversedAt: new Date() })
      .where(eq(stockMovements.id, original.id));

    const [row] = await tx
      .insert(stockMovements)
      .values({
        clinicId: original.clinicId,
        itemId: original.itemId,
        type: original.type,
        quantity: negateQuantity(normalise(original.quantity)),
        unitPrice: original.unitPrice,
        batchNo: original.batchNo,
        expiryDate: original.expiryDate,
        supplierId: original.supplierId,
        patientId: original.patientId,
        performedProcedureId: original.performedProcedureId,
        reason,
        reversesId: original.id,
        createdBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to reverse the movement");
    }

    return toMovement(row);
  }

  private async write(
    actor: AuthenticatedUser,
    values: {
      itemId: string;
      type: MovementType;
      quantity: string;
      unitPrice?: string | null;
      supplierId?: string | null;
      patientId?: string | null;
      performedProcedureId?: string | null;
      batchNo?: string | null;
      expiryDate?: string | null;
      reason?: string | null;
      requestId?: string | null;
    },
    executor: DatabaseExecutor = this.db,
  ): Promise<StockMovement> {
    const thousandths = toThousandths(values.quantity);

    if (thousandths === 0) {
      throw new BadRequestException("A movement cannot be zero");
    }
    if (values.type === MOVEMENT_TYPE.PURCHASE && thousandths < 0) {
      throw new BadRequestException("A purchase must be positive");
    }
    if (values.type === MOVEMENT_TYPE.CONSUME && thousandths > 0) {
      throw new BadRequestException("A consumption must be negative");
    }

    const [row] = await executor
      .insert(stockMovements)
      .values({
        clinicId: actor.clinicId,
        itemId: values.itemId,
        type: values.type,
        quantity: formatThousandths(thousandths),
        unitPrice: values.unitPrice ?? null,
        supplierId: values.supplierId ?? null,
        patientId: values.patientId ?? null,
        performedProcedureId: values.performedProcedureId ?? null,
        batchNo: values.batchNo ?? null,
        expiryDate: values.expiryDate ?? null,
        reason: values.reason ?? null,
        requestId: values.requestId ?? null,
        createdBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to record the movement");
    }

    return toMovement(row);
  }
}
