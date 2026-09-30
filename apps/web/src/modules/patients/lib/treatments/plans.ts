import { TREATMENT_PLAN_STATUS, type TreatmentPlan } from "@clinic/shared";

export function isOpenPlan(plan: Pick<TreatmentPlan, "status">): boolean {
  return (
    plan.status === TREATMENT_PLAN_STATUS.DRAFT || plan.status === TREATMENT_PLAN_STATUS.ACTIVE
  );
}
