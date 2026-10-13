import type { JSX } from "react";
import { StatsList } from "@web/site/components/stats-list";
import { Tagline } from "@web/site/components/tagline";
import { useSite } from "@web/site/hooks/use-site";

export function StatsBand(): JSX.Element | null {
  const { site, t } = useSite();
  const { stats } = site.content.about;

  if (stats.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="site-stats"
      aria-label={t("home.statsLabel")}
      className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center"
    >
      <StatsList stats={stats} className="flex-1" />
      <Tagline className="hidden md:flex md:border-s md:border-line md:ps-8" />
    </section>
  );
}
