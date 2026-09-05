import { addMoney, type Money, type TreatmentPlanItem } from '@clinic/shared';

/**
 * What a plan is quoted at.
 *
 * Summed through the shared money helpers, which work in integer minor units:
 * adding prices as floats is how a three-item plan ends up quoting 599.9999
 * (CLAUDE.md — never a float for money).
 */
export function planTotal(items: readonly TreatmentPlanItem[]): Money {
  return items.reduce<Money>((total, item) => addMoney(total, item.estimatedPrice), '0.00');
}

/**
 * What is left to do, in money: the items still planned.
 *
 * Converted items have become real procedures with their own price, and
 * cancelled ones are not owed, so neither belongs in the remaining quote.
 */
export function planRemaining(items: readonly TreatmentPlanItem[]): Money {
  return planTotal(items.filter((item) => item.status === 'planned'));
}
