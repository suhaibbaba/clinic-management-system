import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Widget } from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { cn } from "@clinic/ui/lib/cn";
import { Money } from "@web/shared/components/money";
import { formatDate, formatWeekday } from "@web/shared/lib/format";
import { useDashboardCollections } from "@web/modules/dashboard/queries";

export function CollectionsChart({
  currency,
}: {
  readonly currency: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const collections = useDashboardCollections();
  const days = collections.data?.days ?? [];
  const highest = Math.max(1, ...days.map((day) => Number(day.total)));
  const week = days.reduce((sum, day) => sum + Number(day.total), 0);

  return (
    <Widget
      data-testid="dashboard-collections"
      title={t("dashboard.widgets.collections.title")}
      action={
        collections.data && (
          <Money amount={week.toFixed(2)} currency={currency} className="font-semibold" />
        )
      }
    >
      {collections.isPending && (
        <Skeleton aria-hidden="true" className="mt-3 h-40 w-full rounded-panel" />
      )}

      {collections.data && (
        <ol className="mt-4 flex h-40 items-end gap-2">
          {days.map((day, index) => {
            const today = index === days.length - 1;
            const share = Number(day.total) / highest;

            return (
              <li
                key={day.date}
                data-testid={`dashboard-collections-${day.date}`}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
              >
                <span className="sr-only">
                  {formatDate(day.date)} <Money amount={day.total} currency={currency} />
                </span>
                <span
                  aria-hidden="true"
                  title={formatDate(day.date)}
                  style={{ height: `${Math.max(share * 100, 3)}%` }}
                  className={cn(
                    "w-full max-w-8 rounded-t-field",
                    today ? "bg-primary-600" : "bg-primary-200",
                  )}
                />
                <span
                  aria-hidden="true"
                  className="w-full truncate text-center text-micro text-ink-muted"
                >
                  {formatWeekday(day.date)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Widget>
  );
}
