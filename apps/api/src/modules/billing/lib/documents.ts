import { type StatementEntry, LEDGER_ENTRY_KIND, type Statement } from "@clinic/shared";
import { type DocumentStrings } from "@api/modules/billing/pdf/document-strings";
import { type Cell } from "@api/modules/billing/pdf/pdf-builder";
import { receiptNumber, documentDate } from "@api/modules/billing/pdf/document-format";

export function describe(entry: StatementEntry, text: DocumentStrings["statement"]): Cell {
  if (entry.kind === LEDGER_ENTRY_KIND.PAYMENT) {
    const title = entry.isReversal
      ? text.reversedPayment
      : entry.receiptNumber !== null
        ? `${text.payment} ${receiptNumber(entry.receiptNumber)}`
        : text.payment;

    return { text: title, sub: entry.note ?? undefined };
  }

  const note = entry.note && entry.note !== entry.description ? entry.note : undefined;
  const sub = [entry.isReversal ? text.reversal : undefined, note].filter(Boolean).join(" · ");

  return { text: entry.description || text.columns.charge, sub: sub || undefined };
}

export function formatPeriod(statement: Statement, timeZone: string, all: string): string {
  const to = documentDate(statement.to ?? new Date().toISOString(), timeZone);

  return statement.from ? `${documentDate(statement.from, timeZone)} – ${to}` : `${all} ${to}`;
}
