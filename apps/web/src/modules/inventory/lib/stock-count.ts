import { subtractQuantity, type StockCountLine } from "@clinic/shared";

export function countChanges(
  lines: readonly StockCountLine[],
  typed: Readonly<Record<string, string>>,
): { itemId: string; counted: string | null }[] {
  return lines.flatMap((line) => {
    const value = (typed[line.itemId] ?? "").trim();
    const counted = value === "" ? null : value;

    return (counted === null ? null : Number(counted)) ===
      (line.counted === null ? null : Number(line.counted))
      ? []
      : [{ itemId: line.itemId, counted }];
  });
}

export function countDifference(typed: string, current: string): string | null {
  const value = typed.trim();

  return value === "" ? null : subtractQuantity(value, current);
}
