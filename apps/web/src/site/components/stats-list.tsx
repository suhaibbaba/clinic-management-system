import type { SiteStat } from "@clinic/shared";
import type { JSX } from "react";
import { cx } from "@web/booking/ui";
import { SiteIcon } from "@web/site/components/site-icon";
import { useSite } from "@web/site/hooks/use-site";
import { pick } from "@web/site/lib/text";

export function StatsList({
  stats,
  className,
}: {
  readonly stats: readonly SiteStat[];
  readonly className?: string;
}): JSX.Element {
  const { language } = useSite();

  return (
    <ul
      data-testid="site-stats-list"
      data-reveal-group
      className={cx(
        "grid grid-cols-2 gap-y-8 sm:grid-cols-4 sm:divide-x sm:divide-line",
        className,
      )}
    >
      {stats.map((stat, position) => (
        <li key={position} className="flex flex-col items-center gap-2 px-3 text-center">
          <SiteIcon name={stat.icon} className="size-9 text-primary-600" />
          <bdi className="text-kpi font-bold text-primary-900">{stat.value}</bdi>
          <span className="text-label text-ink-muted">{pick(stat.label, language)}</span>
        </li>
      ))}
    </ul>
  );
}
