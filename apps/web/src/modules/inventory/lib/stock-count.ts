import { subtractQuantity, type RecordCountsInput, type StockCountLine } from "@clinic/shared";
import type { CountFilter } from "@web/modules/inventory/constants";

export interface SurplusDetails {
  readonly unitPrice: string;
  readonly expiryDate: string;
}

export function savedDetails(lines: readonly StockCountLine[]): Record<string, SurplusDetails> {
  return Object.fromEntries(
    lines.map((line) => [
      line.itemId,
      { unitPrice: line.unitPrice ?? "", expiryDate: line.expiryDate ?? "" },
    ]),
  );
}

const sameNumber = (typed: string, saved: string | null | undefined): boolean =>
  (typed === "" ? null : Number(typed)) === (saved == null ? null : Number(saved));

export function countChanges(
  lines: readonly StockCountLine[],
  typed: Readonly<Record<string, string>>,
  details: Readonly<Record<string, SurplusDetails>> = {},
  mayPrice = false,
): RecordCountsInput["lines"] {
  return lines.flatMap((line) => {
    const counted = (typed[line.itemId] ?? "").trim();
    const unitPrice = (details[line.itemId]?.unitPrice ?? line.unitPrice ?? "").trim();
    const expiryDate = details[line.itemId]?.expiryDate ?? line.expiryDate ?? "";
    const changed =
      !sameNumber(counted, line.counted) ||
      expiryDate !== (line.expiryDate ?? "") ||
      (mayPrice && !sameNumber(unitPrice, line.unitPrice));

    return changed
      ? [
          {
            itemId: line.itemId,
            counted: counted === "" ? null : counted,
            expiryDate: expiryDate === "" ? null : expiryDate,
            ...(mayPrice && { unitPrice: unitPrice === "" ? null : unitPrice }),
          },
        ]
      : [];
  });
}

export function countDifference(typed: string, current: string): string | null {
  const value = typed.trim();

  return value === "" ? null : subtractQuantity(value, current);
}

export function lineDifference(
  line: StockCountLine,
  typed: Readonly<Record<string, string>>,
  open: boolean,
): string | null {
  return open ? countDifference(typed[line.itemId] ?? "", line.current) : line.difference;
}

export interface CountProgress {
  readonly total: number;
  readonly counted: number;
  readonly shortages: number;
  readonly surpluses: number;
}

export function countProgress(
  lines: readonly StockCountLine[],
  typed: Readonly<Record<string, string>>,
  open: boolean,
): CountProgress {
  const differences = lines.map((line) => lineDifference(line, typed, open));

  return {
    total: lines.length,
    counted: differences.filter((difference) => difference !== null).length,
    shortages: differences.filter((difference) => difference !== null && Number(difference) < 0)
      .length,
    surpluses: differences.filter((difference) => difference !== null && Number(difference) > 0)
      .length,
  };
}

export function visibleCountLines(
  lines: readonly StockCountLine[],
  typed: Readonly<Record<string, string>>,
  open: boolean,
  filter: CountFilter,
  search: string,
): StockCountLine[] {
  const needle = search.trim().toLocaleLowerCase();

  return lines.filter((line) => {
    const difference = lineDifference(line, typed, open);

    return (
      (needle === "" || line.itemName.toLocaleLowerCase().includes(needle)) &&
      (filter === "all" ||
        (filter === "remaining" && difference === null) ||
        (filter === "differences" && difference !== null && Number(difference) !== 0))
    );
  });
}
