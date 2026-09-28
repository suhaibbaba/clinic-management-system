import { addMoney, type Money, type TreatmentPlanItem } from "@clinic/shared";

export function planTotal(items: readonly TreatmentPlanItem[]): Money {
  return items.reduce<Money>((total, item) => addMoney(total, item.estimatedPrice), "0.00");
}

export function planRemaining(items: readonly TreatmentPlanItem[]): Money {
  return planTotal(items.filter((item) => item.status === "planned"));
}
