import { addQuantity, formatThousandths, toThousandths } from '@shared/schemas/quantity';

// Derived for the screen, never stored: the ledger is batch-agnostic, so batches assume oldest-
// first (earliest expiry, else purchase date). `sum(quantity)` is unaffected.
export interface BatchInflow {
  readonly batchNo: string | null;
  readonly expiryDate: string | null;
  /** ISO datetime the stock arrived — the tiebreak, and the display date. */
  readonly receivedAt: string;
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

// Same lot number is one batch; anything unlabelled stays separate, because two unlabelled
// deliveries have two expiries.
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
    // A batch drained past its own size spills into the general pool rather than going negative,
    // which would hide a miscount.
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

// Earliest expiry still holding stock — computed from what is left, because a batch that is used up
// cannot expire.
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
