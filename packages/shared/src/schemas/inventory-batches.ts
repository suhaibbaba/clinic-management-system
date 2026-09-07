import { addQuantity, formatThousandths, toThousandths } from '@shared/schemas/quantity';

/**
 * What is left of each batch — worked out for the screen, not stored.
 *
 * The ledger is deliberately batch-agnostic: a movement records that six
 * ampoules were used, not which box they came out of, because nobody at a
 * chairside writes down a lot number and a stock system that demands one gets
 * fed lies. Expiry, though, is per batch, so "what goes off next, and how much
 * of it is left" has to be *derived* — and the only honest way to derive it is
 * to state the assumption out loud: **the oldest stock is used first.**
 *
 * "Oldest" is the earliest expiry where one is known, falling back to the
 * purchase date. That is what a clinic does with its own hands — you reach for
 * the box going off first — and the two orderings agree whenever stock is
 * bought in expiry order, which is the ordinary case.
 *
 * Where a movement *does* name a batch, it is not a guess at all: that
 * quantity comes off that batch and nothing else. The assumption only fills
 * the gaps.
 *
 * None of this changes a single number in the ledger. `sum(quantity)` remains
 * the item's quantity; this only says where within that total the stock sits.
 */
export interface BatchInflow {
  /** Lot number as written on the box, when there is one. */
  readonly batchNo: string | null;
  /** ISO date. */
  readonly expiryDate: string | null;
  /** ISO datetime the stock arrived — the tiebreak, and the display date. */
  readonly receivedAt: string;
  /** Positive. */
  readonly quantity: string;
}

export interface BatchOutflow {
  /** Named batch, or `null` for the ordinary case where nobody wrote it down. */
  readonly batchNo: string | null;
  /** Positive magnitude — the sign lives in the ledger, not here. */
  readonly quantity: string;
}

export interface BatchRemaining {
  readonly batchNo: string | null;
  readonly expiryDate: string | null;
  readonly receivedAt: string;
  /** What arrived in this batch, in total. */
  readonly quantity: string;
  /** What is left of it under the assumption above. Never negative. */
  readonly remaining: string;
}

/** Sorts oldest first: earliest expiry, then earliest arrival. */
const DRAIN_ORDER = (left: BatchInflow, right: BatchInflow): number => {
  if (left.expiryDate !== right.expiryDate) {
    // A batch with no expiry cannot be the one going off next, so it waits.
    if (left.expiryDate === null) {
      return 1;
    }
    if (right.expiryDate === null) {
      return -1;
    }

    return left.expiryDate.localeCompare(right.expiryDate);
  }

  return left.receivedAt.localeCompare(right.receivedAt);
};

/**
 * Merges arrivals into batches and drains them.
 *
 * Two purchases carrying the same lot number are one batch — that is what a
 * lot number means — and they keep the earlier arrival date. Everything with
 * no lot number stays separate, because two unlabelled deliveries are two
 * deliveries with two different expiries.
 */
export function batchesRemaining(
  inflows: readonly BatchInflow[],
  outflows: readonly BatchOutflow[],
): BatchRemaining[] {
  const batches: BatchInflow[] = [];

  for (const inflow of inflows) {
    const existing =
      inflow.batchNo === null
        ? undefined
        : batches.find((batch) => batch.batchNo === inflow.batchNo);

    if (!existing) {
      batches.push(inflow);
      continue;
    }

    batches.splice(batches.indexOf(existing), 1, {
      batchNo: existing.batchNo,
      expiryDate: existing.expiryDate ?? inflow.expiryDate,
      receivedAt:
        existing.receivedAt.localeCompare(inflow.receivedAt) <= 0
          ? existing.receivedAt
          : inflow.receivedAt,
      quantity: addQuantity(existing.quantity, inflow.quantity),
    });
  }

  const ordered = [...batches].sort(DRAIN_ORDER);
  const remaining = ordered.map((batch) => toThousandths(batch.quantity));

  // Named first: a movement that says which box it came from is a fact, and
  // facts must not be spent on the assumption's behalf.
  let unassigned = 0;

  for (const outflow of outflows) {
    const amount = Math.abs(toThousandths(outflow.quantity));
    const index =
      outflow.batchNo === null
        ? -1
        : ordered.findIndex((batch) => batch.batchNo === outflow.batchNo);

    if (index === -1) {
      unassigned += amount;
      continue;
    }

    const taken = Math.min(remaining[index] ?? 0, amount);
    remaining[index] = (remaining[index] ?? 0) - taken;
    // A batch drained past its own size spills over into the general pool
    // rather than going negative: the count is wrong somewhere, and pretending
    // one batch is at -3 hides that.
    unassigned += amount - taken;
  }

  for (let index = 0; index < remaining.length && unassigned > 0; index += 1) {
    const taken = Math.min(remaining[index] ?? 0, unassigned);
    remaining[index] = (remaining[index] ?? 0) - taken;
    unassigned -= taken;
  }

  return ordered.map((batch, index) => ({
    batchNo: batch.batchNo,
    expiryDate: batch.expiryDate,
    receivedAt: batch.receivedAt,
    quantity: batch.quantity,
    remaining: formatThousandths(Math.max(remaining[index] ?? 0, 0)),
  }));
}

/**
 * The date the clinic should be looking at: the earliest expiry still holding
 * stock. A batch that is used up cannot expire, which is the whole reason this
 * is computed from what is left rather than from what was bought.
 */
export function nearestExpiry(batches: readonly BatchRemaining[]): string | null {
  const live = batches.filter(
    (batch) => batch.expiryDate !== null && toThousandths(batch.remaining) > 0,
  );

  return live.reduce<string | null>(
    (earliest, batch) =>
      earliest === null || (batch.expiryDate as string) < earliest
        ? (batch.expiryDate as string)
        : earliest,
    null,
  );
}
