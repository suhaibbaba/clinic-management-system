import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import {
  MOVEMENT_TYPE,
  RULE,
  STOCK_ERROR,
  negateQuantity,
  toThousandths,
  type AdjustStockInput,
  type ConsumeStockInput,
  type CorrectPurchaseInput,
  type ItemBatch,
  type ListMovementsQuery,
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
  patients,
  performedProcedures,
  procedureCatalog,
  stockMovements,
  suppliers,
  users,
} from "@api/database/schema";
import { InventoryItemsService } from "@api/modules/inventory/services/inventory-items.service";
import { fefoSlices, normalise } from "@api/modules/inventory/lib/stock";
import { STOCK_MOVEMENTS_ENTITY } from "@api/common/constants/audit-entities";
import {
  toMovement,
  withoutCost,
  type MovementRow,
} from "@api/modules/inventory/lib/stock-movements";
import { costIn, costOut } from "@api/modules/inventory/lib/costing";
import { STOCK_MOVEMENTS_REQUEST_INDEX } from "@api/modules/inventory/constants";
import { StockService } from "@api/modules/inventory/services/stock.service";
import { StockLedgerService } from "@api/modules/inventory/services/stock-ledger.service";
import { PurchasingService } from "@api/modules/inventory/services/purchasing.service";
import { UNIQUE_VIOLATION } from "@api/common/constants/postgres-errors";
import { violatedConstraint } from "@api/common/lib/postgres-errors";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";

@Injectable()
export class StockMovementsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly items: InventoryItemsService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
    private readonly permissions: PermissionsService,
    private readonly stock: StockService,
    private readonly ledger: StockLedgerService,
    private readonly purchasing: PurchasingService,
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
    return withoutCost(
      await this.purchasing.purchaseOne(actor, input),
      await this.seesCosts(actor),
    );
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
      await this.ledger.lockItems(tx, actor.clinicId, [input.itemId]);

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

      const written: MovementRow[] = [];

      for (const [index, slice] of slices.entries()) {
        const cost = costOut(
          await this.ledger.layers(tx, actor.clinicId, input.itemId),
          slice.thousandths,
        );

        written.push(
          await this.ledger.insert(tx, actor, {
            itemId: input.itemId,
            type: MOVEMENT_TYPE.CONSUME,
            quantity: -slice.thousandths,
            value: cost.value,
            unknown: cost.unknown,
            patientId,
            performedProcedureId: input.performedProcedureId ?? null,
            batchNo: slice.batchNo,
            reason: input.reason ?? null,
            requestId: index === 0 ? (input.requestId ?? null) : null,
          }),
        );
      }

      const [first, ...rest] = written.map(toMovement);

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

    const quantity = toThousandths(input.quantity);

    if (quantity === 0) {
      throw new BadRequestException("An adjustment cannot be zero");
    }
    if (quantity < 0 && -quantity < 1000) {
      throw new BadRequestException(STOCK_ERROR.BELOW_ONE);
    }

    return this.db.transaction(async (tx) => {
      await this.ledger.lockItems(tx, actor.clinicId, [input.itemId]);

      const layers = await this.ledger.layers(tx, actor.clinicId, input.itemId);

      if (quantity < 0 && -quantity > layers.onHand) {
        throw new ConflictException(STOCK_ERROR.INSUFFICIENT);
      }

      const cost = quantity < 0 ? costOut(layers, -quantity) : costIn(layers, quantity);

      return toMovement(
        await this.ledger.insert(tx, actor, {
          itemId: input.itemId,
          type: MOVEMENT_TYPE.ADJUST,
          quantity,
          value: cost.value,
          unknown: cost.unknown,
          reason: input.reason,
          batchNo: input.batchNo ?? null,
          expiryDate: input.expiryDate ?? null,
          requestId: input.requestId ?? null,
        }),
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

  private async assertUsable(
    tx: DatabaseExecutor,
    clinicId: string,
    itemId: string,
    taking: string,
    batchNo: string | null | undefined,
  ): Promise<ItemBatch[]> {
    const { onHand } = await this.ledger.layers(tx, clinicId, itemId);
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
    const target = await this.ledger.find(actor.clinicId, id);

    if (target?.receiptLineId && target.type === MOVEMENT_TYPE.PURCHASE && !target.reversesId) {
      return this.purchasing.voidPurchaseMovement(actor, target, input.reason);
    }

    return this.db.transaction(async (tx) => {
      const original = await this.lockOpen(tx, actor, id);

      await this.ledger.lockItems(tx, actor.clinicId, [original.itemId]);

      const { onHand } = await this.ledger.layers(tx, actor.clinicId, original.itemId);

      if (toThousandths(original.quantity) > onHand) {
        throw new ConflictException(STOCK_ERROR.INSUFFICIENT);
      }

      return toMovement(await this.ledger.reverse(tx, actor, original, input.reason));
    });
  }

  async correctPurchase(
    actor: AuthenticatedUser,
    id: string,
    input: CorrectPurchaseInput,
  ): Promise<StockMovement> {
    return withoutCost(
      await this.purchasing.correctPurchaseMovement(actor, id, input),
      await this.seesCosts(actor),
    );
  }

  private async lockOpen(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    id: string,
  ): Promise<MovementRow> {
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
}
