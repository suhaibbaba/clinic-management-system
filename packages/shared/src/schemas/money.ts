import { z } from "zod";

export const moneySchema = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, "Expected an amount with at most two decimal places");

export type Money = z.infer<typeof moneySchema>;

export const signedMoneySchema = z
  .string()
  .regex(/^-?\d{1,8}(\.\d{1,2})?$/, "Expected an amount with at most two decimal places");

export function addMoney(left: Money, right: Money): Money {
  return formatMinorUnits(toMinorUnits(left) + toMinorUnits(right));
}

export function subtractMoney(left: Money, right: Money): Money {
  return formatMinorUnits(toMinorUnits(left) - toMinorUnits(right));
}

export function toMinorUnits(value: Money): number {
  const negative = value.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const magnitude = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  return negative ? -magnitude : magnitude;
}

export function formatMinorUnits(minorUnits: number): Money {
  const sign = minorUnits < 0 ? "-" : "";
  const absolute = Math.abs(minorUnits);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

export const wholeMoneySchema = z
  .string()
  .regex(/^\d{1,8}(\.0{1,2})?$/, "Expected a whole amount")
  .transform((value) => `${value.split(".")[0] ?? "0"}.00`);

export const isWholeMoney = (value: string): boolean => /^\d{1,8}(\.0{1,2})?$/.test(value);

export const CURRENCY_SYMBOLS: Record<string, string> = {
  JOD: "د.ا",
  ILS: "₪",
  USD: "$",
};

export function currencySymbol(code: string | undefined): string {
  if (!code) {
    return "";
  }

  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? code;
}

export function formatWholeMoney(amount: string): string {
  const negative = amount.startsWith("-");
  const [whole = "0"] = (negative ? amount.slice(1) : amount).split(".");

  return `${negative ? "-" : ""}${whole}`;
}
