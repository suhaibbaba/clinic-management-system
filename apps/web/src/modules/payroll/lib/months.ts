export function currentMonth(today: string): string {
  return today.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [year = 0, index = 1] = month.split("-").map(Number);
  const total = year * 12 + (index - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextIndex = (total % 12) + 1;

  return `${String(nextYear).padStart(4, "0")}-${String(nextIndex).padStart(2, "0")}`;
}

export function isMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
