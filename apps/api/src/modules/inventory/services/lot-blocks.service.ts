import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  AUDIT_ACTION,
  MOVEMENT_TYPE,
  STOCK_ERROR,
  type BlockLotInput,
  type ListLotBlocksQuery,
  type LotBlock,
} from "@clinic/shared";
import { and, asc, desc, eq, inArray, isNull, lt, type SQL } from "drizzle-orm";
import { toOptionalPersonName } from "@api/common/person-name";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { inventoryItems, lotBlocks, patients, stockMovements, users } from "@api/database/schema";
import { AuditService } from "@api/modules/audit/services/audit.service";
import { InventoryItemsService } from "@api/modules/inventory/services/inventory-items.service";
import { StockService } from "@api/modules/inventory/services/stock.service";
import { normalise } from "@api/modules/inventory/lib/stock";
import { LOT_BLOCKS_ENTITY } from "@api/common/constants/audit-entities";
import { UNIQUE_VIOLATION } from "@api/common/constants/postgres-errors";
import { violatedConstraint } from "@api/common/lib/postgres-errors";

@Injectable()
export class LotBlocksService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly items: InventoryItemsService,
    private readonly stock: StockService,
    private readonly audit: AuditService,
  ) {}

  async block(actor: AuthenticatedUser, itemId: string, input: BlockLotInput): Promise<LotBlock> {
    await this.items.requireRow(actor.clinicId, itemId);

    const [received] = await this.db
      .select({ id: stockMovements.id })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.clinicId, actor.clinicId),
          eq(stockMovements.itemId, itemId),
          eq(stockMovements.batchNo, input.batchNo),
        ),
      )
      .limit(1);

    if (!received) {
      throw new NotFoundException("Resource not found");
    }

    try {
      const id = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(lotBlocks)
          .values({
            clinicId: actor.clinicId,
            itemId,
            batchNo: input.batchNo,
            reason: input.reason,
            createdBy: actor.id,
          })
          .returning();

        if (!row) {
          throw new Error("Failed to block the lot");
        }

        await this.audit.record(
          {
            clinicId: actor.clinicId,
            userId: actor.id,
            action: AUDIT_ACTION.CREATE,
            entity: LOT_BLOCKS_ENTITY,
            entityId: row.id,
            oldValue: null,
            newValue: { ...row },
          },
          tx,
        );

        return row.id;
      });

      return this.one(actor.clinicId, id);
    } catch (error) {
      if (violatedConstraint(error, UNIQUE_VIOLATION)) {
        throw new ConflictException(STOCK_ERROR.ALREADY_BLOCKED);
      }

      throw error;
    }
  }

  async lift(actor: AuthenticatedUser, id: string, reason: string): Promise<LotBlock> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(lotBlocks)
        .where(and(eq(lotBlocks.id, id), eq(lotBlocks.clinicId, actor.clinicId)))
        .for("update");

      if (!row || row.liftedAt !== null) {
        throw new NotFoundException("Resource not found");
      }

      await tx
        .update(lotBlocks)
        .set({ liftedAt: new Date(), liftedBy: actor.id, liftReason: reason })
        .where(eq(lotBlocks.id, id));

      await this.audit.record(
        {
          clinicId: actor.clinicId,
          userId: actor.id,
          action: AUDIT_ACTION.UPDATE,
          entity: LOT_BLOCKS_ENTITY,
          entityId: id,
          oldValue: { liftedAt: null },
          newValue: { liftedAt: new Date().toISOString(), reason },
        },
        tx,
      );
    });

    return this.one(actor.clinicId, id);
  }

  async list(actor: AuthenticatedUser, query: ListLotBlocksQuery): Promise<LotBlock[]> {
    const filters: (SQL | undefined)[] = [eq(lotBlocks.clinicId, actor.clinicId)];

    if (query.itemId) {
      await this.items.requireRow(actor.clinicId, query.itemId);
      filters.push(eq(lotBlocks.itemId, query.itemId));
    }
    if (!query.includeLifted) {
      filters.push(isNull(lotBlocks.liftedAt));
    }

    return this.load(actor.clinicId, and(...filters));
  }

  private async one(clinicId: string, id: string): Promise<LotBlock> {
    const [row] = await this.load(
      clinicId,
      and(eq(lotBlocks.clinicId, clinicId), eq(lotBlocks.id, id)),
    );

    if (!row) {
      throw new NotFoundException("Resource not found");
    }

    return row;
  }

  private async load(clinicId: string, where: SQL | undefined): Promise<LotBlock[]> {
    const rows = await this.db
      .select({
        block: lotBlocks,
        itemName: inventoryItems.name,
        unit: inventoryItems.unit,
        blockedByNameAr: users.nameAr,
        blockedByNameEn: users.nameEn,
      })
      .from(lotBlocks)
      .innerJoin(inventoryItems, eq(inventoryItems.id, lotBlocks.itemId))
      .leftJoin(users, eq(users.id, lotBlocks.createdBy))
      .where(where)
      .orderBy(desc(lotBlocks.createdAt));

    if (rows.length === 0) {
      return [];
    }

    const itemIds = [...new Set(rows.map((row) => row.block.itemId))];
    const stock = await this.stock.forItems(clinicId, itemIds, 0);
    const uses = await this.db
      .select({
        movement: stockMovements,
        patientName: patients.fullName,
      })
      .from(stockMovements)
      .leftJoin(patients, eq(patients.id, stockMovements.patientId))
      .where(
        and(
          eq(stockMovements.clinicId, clinicId),
          inArray(stockMovements.itemId, itemIds),
          inArray(stockMovements.batchNo, [...new Set(rows.map((row) => row.block.batchNo))]),
          eq(stockMovements.type, MOVEMENT_TYPE.CONSUME),
          lt(stockMovements.quantity, "0"),
          isNull(stockMovements.reversedAt),
          isNull(stockMovements.reversesId),
        ),
      )
      .orderBy(asc(stockMovements.createdAt));

    return rows.map(({ block, itemName, unit, blockedByNameAr, blockedByNameEn }) => {
      const batch = stock
        .get(block.itemId)
        ?.batches.find((candidate) => candidate.batchNo === block.batchNo);

      return {
        id: block.id,
        itemId: block.itemId,
        itemName,
        unit,
        batchNo: block.batchNo,
        expiryDate: batch?.expiryDate ?? null,
        reason: block.reason,
        blockedAt: block.createdAt.toISOString(),
        blockedByName: toOptionalPersonName(blockedByNameAr, blockedByNameEn),
        liftedAt: block.liftedAt?.toISOString() ?? null,
        remaining: batch?.remaining ?? "0",
        uses: uses
          .filter(
            ({ movement }) =>
              movement.itemId === block.itemId && movement.batchNo === block.batchNo,
          )
          .map(({ movement, patientName }) => ({
            movementId: movement.id,
            patientId: movement.patientId,
            patientName,
            quantity: normalise(movement.quantity.replace("-", "")),
            usedAt: movement.createdAt.toISOString(),
          })),
      };
    });
  }
}
