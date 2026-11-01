import {
  SUBSCRIPTION_STATUS,
  type LocalizedText,
  type SaveSubscriptionInput,
  type Subscription,
} from "@clinic/shared";

const pad = (value: number): string => String(value).padStart(2, "0");

export function addMonths(isoDate: string, months: number): string {
  const [year = 1970, month = 1, day = 1] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();

  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(Math.min(day, lastDay))}`;
}

const asInput = (subscription: Subscription): SaveSubscriptionInput => ({
  planId: subscription.planId,
  addOnModules: subscription.addOnModules,
  status: subscription.status,
  startsOn: subscription.startsOn,
  endsOn: subscription.endsOn,
  graceDays: subscription.graceDays,
  notes: subscription.notes,
});

export function extendedByAMonth(
  subscription: Subscription,
  today: string = new Date().toISOString().slice(0, 10),
): SaveSubscriptionInput {
  const from =
    subscription.endsOn !== null && subscription.endsOn > today ? subscription.endsOn : today;

  return {
    ...asInput(subscription),
    status:
      subscription.status === SUBSCRIPTION_STATUS.TRIAL
        ? SUBSCRIPTION_STATUS.TRIAL
        : SUBSCRIPTION_STATUS.ACTIVE,
    endsOn: addMonths(from, 1),
  };
}

export const suspended = (subscription: Subscription): SaveSubscriptionInput => ({
  ...asInput(subscription),
  status: SUBSCRIPTION_STATUS.SUSPENDED,
});

export function initials(name: LocalizedText, language: string): string {
  const text = (name[language as keyof LocalizedText] ?? Object.values(name)[0] ?? "").trim();
  const words = text.split(/\s+/).filter((word) => word.length > 1);
  const picked = words.length > 1 ? [words[1], words[2] ?? words[0]] : [words[0]];

  return picked
    .map((word) => (word ?? "").charAt(0))
    .join("")
    .toUpperCase();
}

export const slugFrom = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 40);

export const profileInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
