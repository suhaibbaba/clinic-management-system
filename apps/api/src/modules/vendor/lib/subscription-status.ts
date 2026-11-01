import { addDays, SUBSCRIPTION_STATUS, type SubscriptionStatus } from "@clinic/shared";

export function nextStatus(
  status: SubscriptionStatus,
  endsOn: string | null,
  graceDays: number,
  today: string,
): SubscriptionStatus {
  if (endsOn === null || endsOn >= today) {
    return status;
  }

  if (addDays(endsOn, graceDays) < today) {
    return SUBSCRIPTION_STATUS.SUSPENDED;
  }

  return status === SUBSCRIPTION_STATUS.GRACE ? status : SUBSCRIPTION_STATUS.GRACE;
}
