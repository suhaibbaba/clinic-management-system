import { type LabStatementEntryKind, type Money } from "@clinic/shared";

export interface LedgerLine {
  readonly id: string;
  readonly kind: LabStatementEntryKind;
  readonly occurredAt: Date;
  readonly amount: Money;
  readonly description: string;
  readonly isReversal: boolean;
}

export function describeOrder(workTypeName: string | null, teeth: readonly number[]): string {
  const name = workTypeName ?? "عمل مخبري";

  return teeth.length > 0 ? `${name} — ${teeth.join("، ")}` : name;
}

export function normalise(value: string): string {
  const [whole = "0", fraction = ""] = value.split(".");

  return `${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}
