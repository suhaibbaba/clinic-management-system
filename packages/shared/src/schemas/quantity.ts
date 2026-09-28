import { z } from "zod";

export const quantitySchema = z
  .string()
  .regex(/^\d{1,9}(\.\d{1,3})?$/, "Expected a quantity with at most three decimal places");

export type Quantity = z.infer<typeof quantitySchema>;

export const signedQuantitySchema = z
  .string()
  .regex(/^-?\d{1,9}(\.\d{1,3})?$/, "Expected a quantity with at most three decimal places");

export const movementQuantitySchema = signedQuantitySchema.refine(
  (value) => toThousandths(value) !== 0,
  "A movement cannot be zero",
);

const SCALE = 1000;

export function toThousandths(value: string): number {
  const negative = value.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const magnitude = Number(whole) * SCALE + Number(fraction.padEnd(3, "0").slice(0, 3));

  return negative ? -magnitude : magnitude;
}

export function formatThousandths(thousandths: number): string {
  const sign = thousandths < 0 ? "-" : "";
  const absolute = Math.abs(thousandths);
  const whole = Math.floor(absolute / SCALE);
  const fraction = String(absolute % SCALE)
    .padStart(3, "0")
    .replace(/0+$/, "");

  return fraction === "" ? `${sign}${whole}` : `${sign}${whole}.${fraction}`;
}

export function addQuantity(left: string, right: string): string {
  return formatThousandths(toThousandths(left) + toThousandths(right));
}

export function subtractQuantity(left: string, right: string): string {
  return formatThousandths(toThousandths(left) - toThousandths(right));
}

export function negateQuantity(value: string): string {
  return formatThousandths(-toThousandths(value));
}

export function compareQuantity(left: string, right: string): number {
  return toThousandths(left) - toThousandths(right);
}

export const quantityToNumber = (value: string): number => toThousandths(value) / SCALE;
