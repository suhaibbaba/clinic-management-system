import type { PortalStatementEntry, StatementEntry } from "@clinic/shared";
import { eq } from "drizzle-orm";
import { doctors, users } from "@api/database/schema";

export const doctorUser = eq(users.id, doctors.userId);

export const toIso = (value: Date): string => value.toISOString();

export function statementLine(entry: StatementEntry): PortalStatementEntry {
  return {
    id: entry.id,
    kind: entry.kind,
    occurredAt: entry.occurredAt,
    description: entry.description === entry.note ? "" : entry.description,
    amount: entry.amount,
    runningBalance: entry.runningBalance,
    receiptNumber: entry.receiptNumber,
    isReversal: entry.isReversal,
    isReversed: entry.isReversed,
  };
}

export function teethByProcedure(
  marks: readonly { readonly procedureId: string; readonly tooth: number | null }[],
): Map<string, number[]> {
  const teeth = new Map<string, number[]>();

  for (const mark of marks) {
    if (mark.tooth === null) {
      continue;
    }

    const list = teeth.get(mark.procedureId) ?? [];

    if (!list.includes(mark.tooth)) {
      list.push(mark.tooth);
    }

    teeth.set(mark.procedureId, list);
  }

  return teeth;
}
