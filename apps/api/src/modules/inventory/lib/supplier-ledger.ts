import {
  addMoney,
  formatMinorUnits,
  formatThousandths,
  SUPPLIER_ENTRY_KIND,
  toMinorUnits,
  toThousandths,
  type Money,
  type SupplierStatement,
  type SupplierStatementEntry,
} from "@clinic/shared";
import { stockMovements, supplierOpeningBalances, supplierPayments } from "@api/database/schema";
import { lineTotal } from "@api/modules/inventory/lib/inventory-reports";

export type SupplierLedgerLine = Omit<SupplierStatementEntry, "occurredAt" | "runningBalance"> & {
  readonly occurredAt: Date;
};

const blank = {
  itemId: null,
  itemName: null,
  unit: null,
  quantity: null,
  unitPrice: null,
  method: null,
  note: null,
};

export function openingLine(row: typeof supplierOpeningBalances.$inferSelect): SupplierLedgerLine {
  return {
    ...blank,
    id: row.id,
    kind: SUPPLIER_ENTRY_KIND.OPENING,
    occurredAt: row.createdAt,
    amount: row.amount,
    isReversal: row.reversesId !== null,
    isReversed: row.reversedAt !== null,
  };
}

export function purchaseLine(
  movement: typeof stockMovements.$inferSelect,
  itemName: string,
  unit: string,
): SupplierLedgerLine {
  return {
    ...blank,
    id: movement.id,
    kind: SUPPLIER_ENTRY_KIND.PURCHASE,
    occurredAt: movement.createdAt,
    itemId: movement.itemId,
    itemName,
    unit,
    quantity: formatThousandths(toThousandths(movement.quantity)),
    unitPrice: movement.unitPrice,
    note: movement.reason,
    amount: movement.unitPrice === null ? null : lineTotal(movement.quantity, movement.unitPrice),
    isReversal: movement.reversesId !== null,
    isReversed: movement.reversedAt !== null,
  };
}

export function paymentLine(row: typeof supplierPayments.$inferSelect): SupplierLedgerLine {
  return {
    ...blank,
    id: row.id,
    kind: SUPPLIER_ENTRY_KIND.PAYMENT,
    occurredAt: row.createdAt,
    method: row.method,
    note: row.note,
    amount: formatMinorUnits(-toMinorUnits(row.amount)),
    isReversal: row.reversesId !== null,
    isReversed: row.reversedAt !== null,
  };
}

export const byOccurrence = (a: SupplierLedgerLine, b: SupplierLedgerLine): number =>
  a.occurredAt.getTime() - b.occurredAt.getTime() ||
  Number(b.isReversal) - Number(a.isReversal) ||
  a.id.localeCompare(b.id);

export function ledgerStatement(
  supplier: { readonly id: string; readonly name: string },
  lines: readonly SupplierLedgerLine[],
  from: Date | null,
  to: Date | null,
): SupplierStatement {
  let running: Money = "0.00";
  let opening: Money = "0.00";
  let purchased = 0;
  let paid = 0;
  const entries: SupplierStatementEntry[] = [];

  for (const line of lines) {
    if (to && line.occurredAt >= to) {
      break;
    }

    running = addMoney(running, line.amount ?? "0.00");

    if (from && line.occurredAt < from) {
      opening = running;
      continue;
    }

    if (line.kind === SUPPLIER_ENTRY_KIND.PURCHASE && line.amount !== null) {
      purchased += toMinorUnits(line.amount);
    }
    if (line.kind === SUPPLIER_ENTRY_KIND.PAYMENT && line.amount !== null) {
      paid -= toMinorUnits(line.amount);
    }

    entries.push({ ...line, occurredAt: line.occurredAt.toISOString(), runningBalance: running });
  }

  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    from: from ? from.toISOString() : null,
    to: to ? to.toISOString() : null,
    openingBalance: opening,
    purchased: formatMinorUnits(purchased),
    paid: formatMinorUnits(paid),
    closingBalance: entries.at(-1)?.runningBalance ?? opening,
    entries,
  };
}
