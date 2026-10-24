import { SITE_SECTION } from "@clinic/shared";
import type { JSX } from "react";
import { PillLink } from "@web/site/components/pill-link";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { useSite } from "@web/site/hooks/use-site";
import { imageOf } from "@web/site/lib/images";
import { orDefault, pick } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

export function AboutTeaser(): JSX.Element | null {
  const { site, language, t } = useSite();
  const { about, story } = site.content;
  const summary = pick(about.body, language).split(/\n{2,}/)[0] ?? "";
  const badge = pick(story.badge, language);

  if (!site.content.sections.includes(SITE_SECTION.ABOUT)) {
    return null;
  }

  return (
    <section
      data-testid="site-about-teaser"
      aria-labelledby="about-teaser-title"
      className="bg-primary-50/60"
    >
      <div className="grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div
          data-reveal
          className="site-gutter-start flex flex-col items-start gap-4 px-4 pb-14 md:py-16 md:pe-8"
        >
          <p className="text-section font-medium text-primary-600">
            {orDefault(about.title, language, t("about.title"))}
          </p>
          <h2
            id="about-teaser-title"
            className="text-title font-bold text-primary-900 md:text-headline"
          >
            {orDefault(story.title, language, t("about.subtitle"))}
          </h2>
          {summary && <p className="line-clamp-4 text-section text-ink-muted">{summary}</p>}
          <PillLink to={SITE_PATH.ABOUT} tone="dark" data-testid="site-about-more">
            {t("home.aboutLink")}
          </PillLink>

          {about.stats.length > 0 && (
            <ul
              data-testid="site-stats"
              aria-label={t("home.statsLabel")}
              data-reveal-group
              className="mt-4 grid w-full grid-cols-2 gap-y-6 sm:grid-cols-4 sm:divide-x sm:divide-line"
            >
              {about.stats.map((stat, position) => (
                <li key={position} className="flex flex-col items-center gap-1 px-2 text-center">
                  <SiteIcon name={stat.icon} className="mb-1 size-8 text-primary-600" />
                  <bdi className="text-title font-bold text-primary-900">{stat.value}</bdi>
                  <span className="text-meta text-ink-muted">{pick(stat.label, language)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative order-first aspect-[4/3] md:order-none md:aspect-auto md:h-full md:min-h-[30rem]">
          <SiteImage
            src={imageOf(site, about.image) ?? imageOf(site, story.image)}
            layer
            data-testid="site-about-teaser-image"
            className="md:site-arc-start"
            fallback={<SiteIcon name="smile" className="size-16" />}
          />
          {badge && (
            <p
              data-testid="site-about-badge"
              className="absolute start-4 top-4 flex items-center gap-2 rounded-card bg-surface/95 px-4 py-2.5 text-label font-bold text-primary-900 shadow-float md:start-auto md:end-8 md:top-8"
            >
              <SiteIcon name="award" className="size-6 text-primary-600" />
              {badge}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
