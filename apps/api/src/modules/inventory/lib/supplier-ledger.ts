import {
  addMoney,
  DEFAULT_TIME_ZONE,
  formatMinorUnits,
  localDate,
  PAYMENT_DIRECTION,
  PURCHASE_DOCUMENT_STATUS,
  SUPPLIER_DOCUMENT_KIND,
  SUPPLIER_ENTRY_KIND,
  toMinorUnits,
  type Money,
  type SupplierStatement,
  type SupplierStatementEntry,
} from "@clinic/shared";
import { supplierInvoices, supplierOpeningBalances, supplierPayments } from "@api/database/schema";

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
  reference: null,
};

const onDate = (date: string, createdAt: Date): Date =>
  localDate(createdAt, DEFAULT_TIME_ZONE) === date ? createdAt : new Date(`${date}T12:00:00.000Z`);

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

export function invoiceLines(row: typeof supplierInvoices.$inferSelect): SupplierLedgerLine[] {
  const reference = row.supplierRef ? `${row.number} · ${row.supplierRef}` : row.number;
  const credit = row.kind === SUPPLIER_DOCUMENT_KIND.CREDIT_NOTE;
  const total = credit ? formatMinorUnits(-toMinorUnits(row.total)) : row.total;
  const posted: SupplierLedgerLine = {
    ...blank,
    id: row.id,
    kind: credit ? SUPPLIER_ENTRY_KIND.CREDIT : SUPPLIER_ENTRY_KIND.PURCHASE,
    occurredAt: onDate(row.invoiceDate, row.createdAt),
    reference,
    note: row.note,
    amount: total,
    isReversal: false,
    isReversed: row.status === PURCHASE_DOCUMENT_STATUS.VOID,
  };

  if (row.status !== PURCHASE_DOCUMENT_STATUS.VOID || !row.voidedAt) {
    return [posted];
  }

  return [
    posted,
    {
      ...posted,
      id: `${row.id.slice(0, 35)}v`,
      occurredAt: row.voidedAt,
      note: row.voidReason,
      amount: formatMinorUnits(-toMinorUnits(total)),
      isReversal: true,
      isReversed: false,
    },
  ];
}

export function paymentLine(row: typeof supplierPayments.$inferSelect): SupplierLedgerLine {
  return {
    ...blank,
    id: row.id,
    kind: SUPPLIER_ENTRY_KIND.PAYMENT,
    occurredAt: row.reversesId ? row.createdAt : onDate(row.paidOn, row.createdAt),
    method: row.method,
    note: row.note,
    amount: formatMinorUnits(
      row.direction === PAYMENT_DIRECTION.REFUND
        ? toMinorUnits(row.amount)
        : -toMinorUnits(row.amount),
    ),
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

    if (
      (line.kind === SUPPLIER_ENTRY_KIND.PURCHASE || line.kind === SUPPLIER_ENTRY_KIND.CREDIT) &&
      line.amount !== null
    ) {
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
