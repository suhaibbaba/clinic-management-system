import { currencySymbol, formatWholeMoney, type Money } from "@clinic/shared";
import { isolateLtr } from "@api/billing/pdf/arabic-text";

const parts = (iso: string, timeZone: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, ...options }).formatToParts(new Date(iso));

const pick = (list: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string =>
  list.find((part) => part.type === type)?.value ?? "";

// Built from parts rather than `toLocaleString('ar')`: that wraps the output in bidi marks, which
// reorder a date laid out right to left.
/** `21/07/2026` in the clinic's zone. */
export function documentDate(iso: string, timeZone: string): string {
  const list = parts(iso, timeZone, { day: "2-digit", month: "2-digit", year: "numeric" });

  return `${pick(list, "day")}/${pick(list, "month")}/${pick(list, "year")}`;
}

/** `21/07/2026 · 10:30 AM`: AM and PM in Latin, as the app writes them. */
export function documentDateTime(iso: string, timeZone: string): string {
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));

  return `${documentDate(iso, timeZone)} · ${time}`;
}

/** Whole numbers and the symbol, never the code — as every screen shows money. */
export function documentMoney(amount: Money, currency: string): string {
  const symbol = currencySymbol(currency);

  return symbol === "" ? formatWholeMoney(amount) : `${formatWholeMoney(amount)} ${symbol}`;
}

/** Isolated: after Arabic letters the digits count as Arabic numbers and leave the `#` behind. */
export const receiptNumber = (value: number): string =>
  isolateLtr(`#${String(value).padStart(6, "0")}`);

export const fillPage = (template: string, page: number, total: number): string =>
  template.replace("{page}", String(page)).replace("{total}", String(total));
