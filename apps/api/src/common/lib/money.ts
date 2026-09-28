import { type Money, formatMinorUnits, toMinorUnits } from "@clinic/shared";

export function normalise(value: string): Money {
  return formatMinorUnits(toMinorUnits(value));
}

export function negate(amount: Money): Money {
  return formatMinorUnits(-toMinorUnits(amount));
}
