import {
  addDays,
  CLINIC_MODULES,
  DEFAULT_PLAN_CODE,
  missingModules,
  READ_ONLY_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS,
  type ClinicModule,
  type Plan,
  type SavePlanInput,
  type SaveSubscriptionInput,
  type SubscriptionStatus,
  type VendorClinicDetail,
} from "@clinic/shared";
import type { BadgeTone } from "@clinic/ui/components/badge";
import { VENDOR_DEFAULT_GRACE_DAYS, VENDOR_TRIAL_DAYS } from "@web/vendor/constants";

export const resultingModules = (
  planModules: readonly ClinicModule[],
  addOns: readonly ClinicModule[],
): ClinicModule[] => {
  const chosen = new Set([...planModules, ...addOns]);

  return CLINIC_MODULES.filter((module) => chosen.has(module));
};

export const lacksDependency = (modules: readonly ClinicModule[]): boolean =>
  missingModules(modules).length > 0;

const TONES: Readonly<Record<SubscriptionStatus, BadgeTone>> = {
  [SUBSCRIPTION_STATUS.TRIAL]: "info",
  [SUBSCRIPTION_STATUS.ACTIVE]: "success",
  [SUBSCRIPTION_STATUS.GRACE]: "warning",
  [SUBSCRIPTION_STATUS.SUSPENDED]: "danger",
  [SUBSCRIPTION_STATUS.CANCELLED]: "danger",
};

export const statusTone = (status: SubscriptionStatus | null): BadgeTone =>
  status === null ? "neutral" : TONES[status];

export const isReadOnly = (status: SubscriptionStatus | null): boolean =>
  status !== null && READ_ONLY_SUBSCRIPTION_STATUSES.includes(status);

export function initialSubscription(
  detail: VendorClinicDetail,
  plans: readonly Plan[],
  today: string = new Date().toISOString().slice(0, 10),
): SaveSubscriptionInput {
  const current = detail.subscription;

  return current
    ? {
        planId: current.planId,
        addOnModules: current.addOnModules,
        status: current.status,
        startsOn: current.startsOn,
        endsOn: current.endsOn,
        graceDays: current.graceDays,
        notes: current.notes,
      }
    : {
        planId: defaultPlanId(plans),
        addOnModules: [],
        status: SUBSCRIPTION_STATUS.TRIAL,
        startsOn: today,
        endsOn: addDays(today, VENDOR_TRIAL_DAYS),
        graceDays: VENDOR_DEFAULT_GRACE_DAYS,
        notes: null,
      };
}

export const defaultPlanId = (plans: readonly Plan[]): string =>
  (
    plans.find((plan) => plan.code === DEFAULT_PLAN_CODE && plan.isActive) ??
    plans.find((plan) => plan.isActive)
  )?.id ?? "";

export const planInput = (plan: Plan | null): SavePlanInput =>
  plan
    ? {
        code: plan.code,
        name: plan.name,
        modules: plan.modules,
        maxUsers: plan.maxUsers,
        maxDoctors: plan.maxDoctors,
        isActive: plan.isActive,
      }
    : { code: "", name: "", modules: [], maxUsers: null, maxDoctors: null, isActive: true };
