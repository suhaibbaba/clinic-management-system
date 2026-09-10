import { Inject, Injectable } from '@nestjs/common';
import {
  batchesRemaining,
  compareQuantity,
  formatThousandths,
  inventorySettings,
  nearestExpiry,
  toThousandths,
  type BatchInflow,
  type BatchOutflow,
  type ItemBatch,
} from '@clinic/shared';
import { eq, sql } from 'drizzle-orm';

import { DATABASE, type Database } from '@api/database/database.module';
import { clinics } from '@api/database/schema';

export interface ItemStock {
  readonly quantity: string;
  readonly batches: ItemBatch[];
  /** Stock held against no batch at all — the rest of the quantity. */
  readonly unbatched: string;
  readonly nearestExpiry: string | null;
  readonly isExpiring: boolean;
  readonly isExpired: boolean;
}

const EMPTY: ItemStock = {
  quantity: '0',
  batches: [],
  unbatched: '0',
  nearestExpiry: null,
  isExpiring: false,
  isExpired: false,
};

// Computed on read from the movements — no quantity column to disagree. Batches go through the
// shared `batchesRemaining` the drawer uses, and the queries are bounded by inflows, not history.
@Injectable()
export class StockService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** How many days ahead this clinic wants to be warned. Cheap, and per call. */
  async expiryWarningDays(clinicId: string): Promise<number> {
    const [row] = await this.db
      .select({ settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    return inventorySettings(row?.settings).expiryWarningDays;
  }

  // `today` and `warningDays` are passed in so forty items ask the clinic for its settings once,
  // and so a test can pin the date.
  async forItems(
    clinicId: string,
    itemIds: readonly string[],
    warningDays: number,
    today = new Date(),
  ): Promise<Map<string, ItemStock>> {
    if (itemIds.length === 0) {
      return new Map();
    }

    const ids = sql.join(
      itemIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    );

    const [inflowRows, outflowRows] = await Promise.all([
      this.db.execute<{
        item_id: string;
        batch_no: string | null;
        expiry_date: string | null;
        received_at: Date;
        quantity: string;
      }>(sql`
        select item_id::text as item_id, batch_no, expiry_date::text as expiry_date,
               created_at as received_at, quantity::text as quantity
        from stock_movements
        where clinic_id = ${clinicId} and item_id in (${ids}) and quantity > 0
        order by created_at asc
      `),
      this.db.execute<{ item_id: string; batch_no: string | null; quantity: string }>(sql`
        select item_id::text as item_id, batch_no, sum(-quantity)::text as quantity
        from stock_movements
        where clinic_id = ${clinicId} and item_id in (${ids}) and quantity < 0
        group by item_id, batch_no
      `),
    ]);

    const inflows = new Map<string, BatchInflow[]>();
    const outflows = new Map<string, BatchOutflow[]>();

    for (const row of inflowRows) {
      const list = inflows.get(row.item_id) ?? [];
      list.push({
        batchNo: row.batch_no,
        expiryDate: row.expiry_date,
        receivedAt: new Date(row.received_at).toISOString(),
        quantity: normalise(row.quantity),
      });
      inflows.set(row.item_id, list);
    }

    for (const row of outflowRows) {
      const list = outflows.get(row.item_id) ?? [];
      list.push({ batchNo: row.batch_no, quantity: normalise(row.quantity) });
      outflows.set(row.item_id, list);
    }

    const stock = new Map<string, ItemStock>();

    for (const itemId of itemIds) {
      stock.set(
        itemId,
        this.derive(inflows.get(itemId) ?? [], outflows.get(itemId) ?? [], warningDays, today),
      );
    }

    return stock;
  }

  async forItem(
    clinicId: string,
    itemId: string,
    warningDays: number,
    today = new Date(),
  ): Promise<ItemStock> {
    const stock = await this.forItems(clinicId, [itemId], warningDays, today);

    return stock.get(itemId) ?? EMPTY;
  }

  // Quantity is the sum of the movements, not of the batch remainders: where they disagree, the
  // ledger's total is the honest number.
  private derive(
    inflows: readonly BatchInflow[],
    outflows: readonly BatchOutflow[],
    warningDays: number,
    today: Date,
  ): ItemStock {
    const quantity = formatThousandths(
      inflows.reduce((total, inflow) => total + toThousandths(inflow.quantity), 0) -
        outflows.reduce((total, outflow) => total + toThousandths(outflow.quantity), 0),
    );

    const remaining = batchesRemaining(inflows, outflows);
    const todayIso = isoDate(today);
    const horizon = isoDate(new Date(today.getTime() + warningDays * 86_400_000));

    const batches = remaining
      .filter((batch) => batch.batchNo !== null || batch.expiryDate !== null)
      .map((batch) => ({
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate,
        receivedAt: batch.receivedAt,
        quantity: batch.quantity,
        remaining: batch.remaining,
        isExpired:
          batch.expiryDate !== null &&
          batch.expiryDate < todayIso &&
          toThousandths(batch.remaining) > 0,
        isExpiring:
          batch.expiryDate !== null &&
          batch.expiryDate >= todayIso &&
          batch.expiryDate <= horizon &&
          toThousandths(batch.remaining) > 0,
      }));

    const held = batches.reduce((total, batch) => total + toThousandths(batch.remaining), 0);

    return {
      quantity,
      batches,
      // What the batch view cannot account for: unlabelled stock, and any
      // amount the count has gone past. Never negative on the display side.
      unbatched: formatThousandths(Math.max(toThousandths(quantity) - held, 0)),
      nearestExpiry: nearestExpiry(remaining),
      isExpiring: batches.some((batch) => batch.isExpiring),
      isExpired: batches.some((batch) => batch.isExpired),
    };
  }
}

/** At or below the minimum, and the minimum is a level somebody actually set. */
export const isLowStock = (quantity: string, minQuantity: string): boolean =>
  toThousandths(minQuantity) > 0 && compareQuantity(quantity, minQuantity) <= 0;

/** Postgres returns `numeric` with its scale attached: `2.000`, `-0.500`. */
export function normalise(value: string): string {
  return formatThousandths(toThousandths(value));
}

/** The clinic's own day, as a plain date — an expiry is a day, not an instant. */
function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
