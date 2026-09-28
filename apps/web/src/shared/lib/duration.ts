import type { TFunction } from "i18next";

export function formatDuration(t: TFunction, totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return t("duration.minutes", { count: minutes });
  }

  if (minutes === 0) {
    return t("duration.hours", { count: hours });
  }

  return t("duration.hoursAndMinutes", {
    hours: t("duration.hours", { count: hours }),
    minutes: t("duration.minutes", { count: minutes }),
  });
}
