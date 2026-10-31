import type { PayrollLine, SettlementPayout } from "@clinic/shared";

export type PayEntryKind = "extra" | "cut" | "salary" | "share" | "remittance";

export interface PayEntry {
  readonly id: string;
  readonly kind: PayEntryKind;
  readonly amount: string;
  readonly note: string | null;
  readonly at: string;
  readonly treatments: number;
  readonly reversal: boolean;
  readonly reversed: boolean;
}

export function payEntries(line: PayrollLine, payouts: readonly SettlementPayout[]): PayEntry[] {
  return [
    ...line.adjustments.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      amount: entry.amount,
      note: entry.reason,
      at: entry.createdAt,
      treatments: 0,
      reversal: entry.reversesId !== null,
      reversed: entry.reversedAt !== null,
    })),
    ...line.payments.map((entry) => ({
      id: entry.id,
      kind: "salary" as const,
      amount: entry.amount,
      note: entry.note,
      at: entry.createdAt,
      treatments: 0,
      reversal: entry.reversesId !== null,
      reversed: entry.reversedAt !== null,
    })),
    ...line.remittances.map((entry) => ({
      id: entry.id,
      kind: "remittance" as const,
      amount: entry.amount,
      note: entry.note,
      at: entry.createdAt,
      treatments: 0,
      reversal: entry.reversesId !== null,
      reversed: entry.reversedAt !== null,
    })),
    ...payouts.map((entry) => ({
      id: entry.id,
      kind: "share" as const,
      amount: entry.amount,
      note: entry.note,
      at: entry.createdAt,
      treatments: entry.items.length,
      reversal: entry.reversesId !== null,
      reversed: entry.reversedAt !== null,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
}

export const isReversible = (entry: PayEntry, closed: boolean): boolean =>
  !entry.reversal &&
  !entry.reversed &&
  (entry.kind === "salary" || entry.kind === "share" || entry.kind === "remittance" || !closed);
