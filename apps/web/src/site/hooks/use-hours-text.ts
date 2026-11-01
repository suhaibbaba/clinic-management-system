import { useSite } from "@web/site/hooks/use-site";
import { hoursSummary, timeLabel, weekdayName } from "@web/site/lib/text";

export function useHoursText(): { readonly days: string; readonly time: string } | null {
  const { site, language, t } = useSite();
  const summary = hoursSummary(site.clinic.workingHours);

  if (!summary) {
    return null;
  }

  return {
    days:
      summary.from === summary.to
        ? weekdayName(summary.from, language)
        : t("contact.hoursSpan", {
            from: weekdayName(summary.from, language),
            to: weekdayName(summary.to, language),
          }),
    time: t("contact.hoursTime", {
      opens: timeLabel(summary.opens, site.clinic.locale.clock),
      closes: timeLabel(summary.closes, site.clinic.locale.clock),
    }),
  };
}
