import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AUDIT_ACTION,
  DEFAULT_TIME_ZONE,
  MOVEMENT_TYPE,
  RULE,
  STOCK_COUNT_ERROR,
  STOCK_COUNT_STATUS,
  STOCK_ERROR,
  formatMinorUnits,
  formatThousandths,
  localDate,
  roundDiv,
  toMinorUnits,
  toThousandths,
  type CreateStockCountInput,
  type RecordCountsInput,
  type StockCount,
  type StockCountStatus,
  type StockCountSummary,
} from "@clinic/shared";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { toOptionalPersonName } from "@api/common/person-name";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database, type DatabaseExecutor } from "@api/database/database.module";
import {
  inventoryItems,
  stockCountLines,
  stockCounts,
  stockMovements,
  users,
} from "@api/database/schema";
import { AuditService } from "@api/modules/audit/services/audit.service";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";
import { PurchasingService } from "@api/modules/inventory/services/purchasing.service";
import { StockLedgerService } from "@api/modules/inventory/services/stock-ledger.service";
import { costIn, costOut } from "@api/modules/inventory/lib/costing";
import { STOCK_COUNTS_ENTITY } from "@api/common/constants/audit-entities";
import { UNIQUE_VIOLATION } from "@api/common/constants/postgres-errors";
import { violatedConstraint } from "@api/common/lib/postgres-errors";

type CountRow = typeof stockCounts.$inferSelect;

@Injectable()
export class StockCountsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly purchasing: PurchasingService,
    private readonly ledger: StockLedgerService,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthenticatedUser): Promise<StockCountSummary[]> {
    const rows = await this.db
      .select({
        count: stockCounts,
        createdByNameAr: users.nameAr,
        createdByNameEn: users.nameEn,
        items: sql<number>`(select count(*)::int from stock_count_lines l where l.count_id = "stock_counts"."id")`,
        counted: sql<number>`(select count(*)::int from stock_count_lines l where l.count_id = "stock_counts"."id" and l.counted is not null)`,
      })
      .from(stockCounts)
      .leftJoin(users, eq(users.id, stockCounts.createdBy))
      .where(eq(stockCounts.clinicId, actor.clinicId))
      .orderBy(desc(stockCounts.createdAt))
      .limit(50);

    return rows.map(({ count, createdByNameAr, createdByNameEn, items, counted }) => ({
      ...this.header(count, toOptionalPersonName(createdByNameAr, createdByNameEn)),
      items,
      counted,
    }));
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<StockCount> {
    const [row] = await this.db
      .select({ count: stockCounts, createdByNameAr: users.nameAr, createdByNameEn: users.nameEn })
      .from(stockCounts)
      .leftJoin(users, eq(users.id, stockCounts.createdBy))
      .where(and(eq(stockCounts.id, id), eq(stockCounts.clinicId, actor.clinicId)))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Resource not found");
    }

    const seesCosts = await this.permissions.can(actor, RULE.INVENTORY_COSTS);
    const lines = await this.db
      .select({ line: stockCountLines, itemName: inventoryItems.name, unit: inventoryItems.unit })
      .from(stockCountLines)
      .innerJoin(inventoryItems, eq(inventoryItems.id, stockCountLines.itemId))
      .where(eq(stockCountLines.countId, id))
      .orderBy(asc(inventoryItems.category), asc(inventoryItems.name));
    const movedValue = await this.movedValues(
      lines.map(({ line }) => line.movementId).filter((value) => value !== null),
    );
    const open = row.count.status === STOCK_COUNT_STATUS.OPEN;
    const current = open
      ? await this.onHand(
          this.db,
          actor.clinicId,
          lines.map(({ line }) => line.itemId),
        )
      : new Map<string, number>();

    return {
      ...this.header(row.count, toOptionalPersonName(row.createdByNameAr, row.createdByNameEn)),
      lines: lines.map(({ line, itemName, unit }) => {
        const expected = toThousandths(line.expected);
        const now = open ? (current.get(line.itemId) ?? 0) : expected;
        const counted = line.counted === null ? null : toThousandths(line.counted);
        const moved = line.movementId ? movedValue.get(line.movementId) : undefined;

        return {
          itemId: line.itemId,
          itemName,
          unit,
          expected: formatThousandths(expected),
          current: formatThousandths(now),
          counted: counted === null ? null : formatThousandths(counted),
          difference:
            counted === null ? null : formatThousandths(counted - (open ? now : expected)),
          expiryDate: line.expiryDate,
          ...(seesCosts && { unitPrice: line.unitPrice, value: moved ?? null }),
        };
      }),
    };
  }

  async create(actor: AuthenticatedUser, input: CreateStockCountInput): Promise<StockCount> {
    const items = await this.db
      .select({ id: inventoryItems.id })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.clinicId, actor.clinicId),
          isNull(inventoryItems.deletedAt),
          input.itemIds?.length
            ? inArray(inventoryItems.id, input.itemIds)
            : eq(inventoryItems.isActive, true),
        ),
      );

    if (items.length === 0 || (input.itemIds && items.length !== new Set(input.itemIds).size)) {
      throw new NotFoundException("Resource not found");
    }

    try {
      const id = await this.db.transaction(async (tx) => {
        const number = await this.purchasing.nextNumber(
          tx,
          actor.clinicId,
          "SC",
          localDate(new Date(), DEFAULT_TIME_ZONE),
        );
        const [row] = await tx
          .insert(stockCounts)
          .values({
            clinicId: actor.clinicId,
            number,
            note: input.note ?? null,
            createdBy: actor.id,
            updatedBy: actor.id,
          })
          .returning();

        if (!row) {
          throw new Error("Failed to start the count");
        }

        const onHand = await this.onHand(
          tx,
          actor.clinicId,
          items.map((item) => item.id),
        );

        await tx.insert(stockCountLines).values(
          items.map((item) => ({
            clinicId: actor.clinicId,
            countId: row.id,
            itemId: item.id,
            expected: formatThousandths(onHand.get(item.id) ?? 0),
          })),
        );

        await this.audit.record(
          {
            clinicId: actor.clinicId,
            userId: actor.id,
            action: AUDIT_ACTION.CREATE,
            entity: STOCK_COUNTS_ENTITY,
            entityId: row.id,
            oldValue: null,
            newValue: { ...row },
          },
          tx,
        );

        return row.id;
      });

      return this.findOne(actor, id);
    } catch (error) {
      if (violatedConstraint(error, UNIQUE_VIOLATION)) {
        throw new ConflictException(STOCK_COUNT_ERROR.ALREADY_OPEN);
      }

      throw error;
    }
  }

  async recordCounts(
    actor: AuthenticatedUser,
    id: string,
    input: RecordCountsInput,
  ): Promise<StockCount> {
    if (
      input.lines.some((line) => line.unitPrice !== undefined) &&
      !(await this.permissions.can(actor, RULE.INVENTORY_COSTS))
    ) {
      throw new ForbiddenException("Forbidden resource");
    }

    await this.db.transaction(async (tx) => {
      await this.lockOpen(tx, actor.clinicId, id);

      for (const line of input.lines) {
        const [updated] = await tx
          .update(stockCountLines)
          .set({
            counted: line.counted,
            ...(line.expiryDate !== undefined && { expiryDate: line.expiryDate }),
            ...(line.unitPrice !== undefined && { unitPrice: line.unitPrice }),
            updatedAt: new Date(),
            updatedBy: actor.id,
          })
          .where(and(eq(stockCountLines.countId, id), eq(stockCountLines.itemId, line.itemId)))
          .returning({ id: stockCountLines.id });

        if (!updated) {
          throw new NotFoundException("Resource not found");
        }
      }
    });

    return this.findOne(actor, id);
  }

  async post(actor: AuthenticatedUser, id: string): Promise<StockCount> {
    await this.db.transaction(async (tx) => {
      const count = await this.lockOpen(tx, actor.clinicId, id);
      const lines = (
        await tx.select().from(stockCountLines).where(eq(stockCountLines.countId, id))
      ).filter((line) => line.counted !== null);

      if (lines.length === 0) {
        throw new ConflictException(STOCK_COUNT_ERROR.INCOMPLETE);
      }

      await this.ledger.lockItems(
        tx,
        actor.clinicId,
        lines.map((line) => line.itemId),
      );

      for (const line of lines) {
        const layers = await this.ledger.layers(tx, actor.clinicId, line.itemId);
        const difference = toThousandths(line.counted ?? "0") - layers.onHand;

        if (difference === 0) {
          continue;
        }
        if (-difference > layers.onHand) {
          throw new ConflictException(STOCK_ERROR.INSUFFICIENT);
        }

        const priced = difference > 0 && line.unitPrice !== null;
        const cost = priced
          ? {
              value: roundDiv(difference * toMinorUnits(line.unitPrice ?? "0"), 1000),
              unknown: 0,
            }
          : difference < 0
            ? costOut(layers, -difference)
            : costIn(layers, difference);
        const movement = await this.ledger.insert(tx, actor, {
          itemId: line.itemId,
          type: MOVEMENT_TYPE.ADJUST,
          quantity: difference,
          value: cost.value,
          unknown: cost.unknown,
          unitPrice: priced ? line.unitPrice : null,
          expiryDate: difference > 0 ? line.expiryDate : null,
          reason: count.number,
          reasonCode: "count",
        });

        await tx
          .update(stockCountLines)
          .set({ movementId: movement.id })
          .where(eq(stockCountLines.id, line.id));
      }

      await this.finish(tx, actor, count, STOCK_COUNT_STATUS.POSTED);
    });

    return this.findOne(actor, id);
  }

  async cancel(actor: AuthenticatedUser, id: string): Promise<StockCount> {
    await this.db.transaction(async (tx) => {
      const count = await this.lockOpen(tx, actor.clinicId, id);
      await this.finish(tx, actor, count, STOCK_COUNT_STATUS.CANCELLED);
    });

    return this.findOne(actor, id);
  }

  private async finish(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    count: CountRow,
    status: StockCountStatus,
  ): Promise<void> {
    await tx
      .update(stockCounts)
      .set({
        status,
        ...(status === STOCK_COUNT_STATUS.POSTED && { postedAt: new Date(), postedBy: actor.id }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(eq(stockCounts.id, count.id));

    await this.audit.record(
      {
        clinicId: actor.clinicId,
        userId: actor.id,
        action: AUDIT_ACTION.UPDATE,
        entity: STOCK_COUNTS_ENTITY,
        entityId: count.id,
        oldValue: { status: count.status },
        newValue: { status },
      },
      tx,
    );
  }

  private async lockOpen(tx: DatabaseExecutor, clinicId: string, id: string): Promise<CountRow> {
    const [row] = await tx
      .select()
      .from(stockCounts)
      .where(and(eq(stockCounts.id, id), eq(stockCounts.clinicId, clinicId)))
      .for("update");

    if (!row) {
      throw new NotFoundException("Resource not found");
    }
    if (row.status !== STOCK_COUNT_STATUS.OPEN) {
      throw new ConflictException(STOCK_COUNT_ERROR.NOT_OPEN);
    }

    return row;
  }

  private async onHand(
    executor: DatabaseExecutor,
    clinicId: string,
    itemIds: readonly string[],
  ): Promise<Map<string, number>> {
    if (itemIds.length === 0) {
      return new Map();
    }

    const rows = await executor
      .select({
        itemId: stockMovements.itemId,
        quantity: sql<string>`coalesce(sum(${stockMovements.quantity}), 0)::text`,
      })
      .from(stockMovements)
      .where(
        and(eq(stockMovements.clinicId, clinicId), inArray(stockMovements.itemId, [...itemIds])),
      )
      .groupBy(stockMovements.itemId);

    return new Map(rows.map((row) => [row.itemId, toThousandths(row.quantity)]));
  }

  private async movedValues(ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({ id: stockMovements.id, value: stockMovements.value })
      .from(stockMovements)
      .where(inArray(stockMovements.id, [...ids]));

    return new Map(rows.map((row) => [row.id, formatMinorUnits(toMinorUnits(row.value))]));
  }

  private header(
    row: CountRow,
    createdByName: StockCount["createdByName"],
  ): Omit<StockCount, "lines"> {
    return {
      id: row.id,
      number: row.number,
      status: row.status,
      note: row.note,
      snapshotAt: row.snapshotAt.toISOString(),
      postedAt: row.postedAt?.toISOString() ?? null,
      createdByName,
    };
  }
}
