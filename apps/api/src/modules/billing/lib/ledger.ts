import { type Money, type LedgerEntryKind, type PersonName } from "@clinic/shared";

export interface PeriodTotals {
  readonly charged: Money;
  readonly collected: Money;
  readonly payments: number;
}

export interface LedgerLine {
  readonly id: string;
  readonly kind: LedgerEntryKind;
  readonly occurredAt: Date;
  readonly amount: Money;
  readonly description: string;
  readonly receiptNumber: number | null;
  readonly isReversal: boolean;
  readonly isReversed: boolean;
  readonly note: string | null;
  readonly deletedAt: Date | null;
  readonly deletedBy: PersonName | null;
}

export interface StatementOptions {
  readonly includeDeleted?: boolean;
}
