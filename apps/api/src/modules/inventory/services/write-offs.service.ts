import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import {
  DEFAULT_TIME_ZONE,
  LOOKUP_LIST,
  MOVEMENT_TYPE,
  RULE,
  STOCK_ERROR,
  localDate,
  toThousandths,
  type StockMovement,
  type WriteOffInput,
} from "@clinic/shared";
import { and, eq } from "drizzle-orm";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { stockMovements } from "@api/database/schema";
import { LookupsService } from "@api/modules/lookups/services/lookups.service";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";
import { InventoryItemsService } from "@api/modules/inventory/services/inventory-items.service";
import { PurchasingService } from "@api/modules/inventory/services/purchasing.service";
import { StockLedgerService } from "@api/modules/inventory/services/stock-ledger.service";
import { StockService } from "@api/modules/inventory/services/stock.service";
import { costOut } from "@api/modules/inventory/lib/costing";
import { wholeUnitError } from "@api/modules/inventory/lib/item-rules";
import { namedSlices } from "@api/modules/inventory/lib/stock";
import { toMovement, withoutCost } from "@api/modules/inventory/lib/stock-movements";
import { UNIQUE_VIOLATION } from "@api/common/constants/postgres-errors";
import { violatedConstraint } from "@api/common/lib/postgres-errors";
import { STOCK_MOVEMENTS_REQUEST_INDEX } from "@api/modules/inventory/constants";

@Injectable()
export class WriteOffsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly items: InventoryItemsService,
    private readonly lookups: LookupsService,
    private readonly permissions: PermissionsService,
    private readonly purchasing: PurchasingService,
    private readonly ledger: StockLedgerService,
    private readonly stock: StockService,
  ) {}

  async writeOff(actor: AuthenticatedUser, input: WriteOffInput): Promise<StockMovement> {
    const seesCosts = await this.permissions.can(actor, RULE.INVENTORY_COSTS);

    if (input.requestId) {
      const earlier = await this.byRequest(actor.clinicId, input.requestId);

      if (earlier) {
        return withoutCost(earlier, seesCosts);
      }
    }

    const item = await this.items.requireRow(actor.clinicId, input.itemId);
    const fraction = wholeUnitError(item, input.quantity);

    if (fraction) {
      throw new BadRequestException(fraction);
    }

    await this.lookups.assertCode(actor.clinicId, LOOKUP_LIST.WRITE_OFF_REASON, input.reasonCode);

    const rights = await this.purchasing.rights(actor);
    const date = input.date ?? localDate(new Date(), DEFAULT_TIME_ZONE);

    try {
      return withoutCost(
        await this.db.transaction(async (tx) => {
          await this.purchasing.assertDate(tx, actor, date, rights.mayBackdate);
          await this.ledger.lockItems(tx, actor.clinicId, [input.itemId]);

          const wanted = toThousandths(input.quantity);
          const layers = await this.ledger.layers(tx, actor.clinicId, input.itemId);

          if (wanted > layers.onHand) {
            throw new ConflictException(STOCK_ERROR.INSUFFICIENT);
          }

          const { batches } = await this.stock.forItem(
            actor.clinicId,
            input.itemId,
            0,
            new Date(),
            tx,
          );
          const slices = namedSlices(batches, wanted, input.batchNo);

          if (!slices) {
            throw new ConflictException(STOCK_ERROR.INSUFFICIENT);
          }

          const written = [];

          for (const [index, slice] of slices.entries()) {
            const cost = costOut(
              await this.ledger.layers(tx, actor.clinicId, input.itemId),
              slice.thousandths,
            );

            written.push(
              await this.ledger.insert(tx, actor, {
                itemId: input.itemId,
                type: MOVEMENT_TYPE.WRITE_OFF,
                quantity: -slice.thousandths,
                value: cost.value,
                unknown: cost.unknown,
                batchNo: slice.batchNo,
                reasonCode: input.reasonCode,
                reason: input.note ?? null,
                occurredOn: date,
                requestId: index === 0 ? (input.requestId ?? null) : null,
              }),
            );
          }

          const [first] = written;

          if (!first) {
            throw new Error("Failed to record the write-off");
          }

          return toMovement(first);
        }),
        seesCosts,
      );
    } catch (error) {
      if (
        input.requestId &&
        violatedConstraint(error, UNIQUE_VIOLATION) === STOCK_MOVEMENTS_REQUEST_INDEX
      ) {
        const replayed = await this.byRequest(actor.clinicId, input.requestId);

        if (replayed) {
          return withoutCost(replayed, seesCosts);
        }
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
}
