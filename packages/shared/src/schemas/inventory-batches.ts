import { addQuantity, formatThousandths, toThousandths } from "@shared/schemas/quantity";

export interface BatchInflow {
  readonly batchNo: string | null;
  readonly expiryDate: string | null;
  readonly receivedAt: string;
  readonly quantity: string;
}

export interface BatchOutflow {
  readonly batchNo: string | null;
  readonly quantity: string;
}

export interface BatchRemaining {
  readonly batchNo: string | null;
  readonly expiryDate: string | null;
  readonly receivedAt: string;
  readonly quantity: string;
  readonly remaining: string;
}

const DRAIN_ORDER = (left: BatchInflow, right: BatchInflow): number => {
  if (left.expiryDate !== right.expiryDate) {
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
