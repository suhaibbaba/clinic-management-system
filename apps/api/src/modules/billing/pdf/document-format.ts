import {
  clockTime,
  currencySymbol,
  formatWholeMoney,
  type ClockFormat,
  type Money,
  type NumberSeparators,
} from "@clinic/shared";
import { isolateLtr } from "@api/modules/billing/pdf/arabic-text";

const parts = (iso: string, timeZone: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, ...options }).formatToParts(new Date(iso));

const pick = (list: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string =>
  list.find((part) => part.type === type)?.value ?? "";

export function documentDate(iso: string, timeZone: string): string {
  const list = parts(iso, timeZone, { day: "2-digit", month: "2-digit", year: "numeric" });

  return `${pick(list, "day")}/${pick(list, "month")}/${pick(list, "year")}`;
}

export function documentTime(iso: string, timeZone: string, clock: ClockFormat = "12h"): string {
  const list = parts(iso, timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const minute = (Number(pick(list, "hour")) % 24) * 60 + Number(pick(list, "minute"));

  return clockTime(minute, clock);
}

export function documentDateTime(
  iso: string,
  timeZone: string,
  clock: ClockFormat = "12h",
): string {
  return `${documentDate(iso, timeZone)} · ${documentTime(iso, timeZone, clock)}`;
}

export function documentMoney(
  amount: Money,
  currency: string,
  separators?: NumberSeparators,
): string {
  const symbol = currencySymbol(currency);
  const figure = formatWholeMoney(amount, separators);

  return symbol === "" ? figure : `${figure} ${symbol}`;
}

export const receiptNumber = (value: number): string =>
  isolateLtr(`#${String(value).padStart(6, "0")}`);

export const fillPage = (template: string, page: number, total: number): string =>
  template.replace("{page}", String(page)).replace("{total}", String(total));
