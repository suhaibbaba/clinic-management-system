import { addMoney, type Money, type TreatmentPlanItem } from '@clinic/shared';

// Summed through the shared money helpers in integer minor units — adding prices as floats is how a
// three-item plan quotes 599.9999.
export function planTotal(items: readonly TreatmentPlanItem[]): Money {
  return items.reduce<Money>((total, item) => addMoney(total, item.estimatedPrice), '0.00');
}

// Converted items have become procedures with their own price and cancelled ones are not owed, so
// neither belongs in the remaining quote.
export function planRemaining(items: readonly TreatmentPlanItem[]): Money {
  return planTotal(items.filter((item) => item.status === 'planned'));
}
