import { SITE_SECTION } from "@clinic/shared";
import type { JSX } from "react";
import { GlassLobe } from "@web/site/components/curves";
import { PillLink } from "@web/site/components/pill-link";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { useSite } from "@web/site/hooks/use-site";
import { imageOf } from "@web/site/lib/images";
import { heroLines, orDefault, pick } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

export function AboutTeaser(): JSX.Element | null {
  const { site, language, t } = useSite();
  const { about, story } = site.content;
  const summary = pick(about.body, language).split(/\n{2,}/)[0] ?? "";
  const badge = pick(story.badge, language);
  const image = imageOf(site, about.image) ?? imageOf(site, story.image);
  const [lead, accent] = heroLines(orDefault(story.title, language, t("about.subtitle")));

  if (!site.content.sections.includes(SITE_SECTION.ABOUT)) {
    return null;
  }

  return (
    <section
      data-testid="site-about-teaser"
      aria-labelledby="about-teaser-title"
      className="site-hero-wash relative overflow-hidden"
    >
      {image && (
        <div aria-hidden className="absolute inset-0 hidden overflow-hidden lg:block">
          <SiteImage src={image} layer wash={false} className="scale-125 opacity-50 blur-3xl" />
          <span className="absolute inset-0 from-surface via-surface/90 via-40% to-primary-50/50 ltr:bg-linear-to-r rtl:bg-linear-to-l" />
        </div>
      )}
      <div className="relative flex flex-col lg:block lg:min-h-[32rem]">
        <div className="relative aspect-[4/3] lg:absolute lg:inset-y-0 lg:end-0 lg:aspect-auto lg:w-[50%]">
          <div className="absolute inset-0 overflow-hidden lg:site-lobe-arc">
            <SiteImage
              src={image}
              layer
              data-testid="site-about-teaser-image"
              fallback={<SiteIcon name="smile" className="size-16" />}
            />
          </div>
          <GlassLobe className="absolute inset-0 hidden size-full overflow-visible lg:block" />
          {badge && (
            <p
              data-testid="site-about-badge"
              className="absolute start-4 top-4 flex items-center gap-2 rounded-pill bg-surface px-4 py-2.5 text-label font-bold text-primary-900 shadow-float lg:start-auto lg:end-8 lg:top-8"
            >
              <SiteIcon name="award" className="size-6 text-primary-600" />
              {badge}
            </p>
          )}
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pt-8 pb-12 lg:py-12">
          <div data-reveal className="flex flex-col items-start gap-4 lg:max-w-[32rem]">
            <p className="flex items-center gap-4 text-section font-medium text-primary-600">
              <span aria-hidden className="h-px w-12 bg-primary-600" />
              {orDefault(about.title, language, t("about.title"))}
            </p>
            <h2 id="about-teaser-title" className="text-headline font-bold text-primary-900">
              {lead}
              {accent && <span className="block text-primary-600">{accent}</span>}
            </h2>
            {summary && <p className="line-clamp-4 text-section text-ink">{summary}</p>}
            <PillLink to={SITE_PATH.ABOUT} tone="dark" data-testid="site-about-more">
              {t("home.aboutLink")}
            </PillLink>

            {about.stats.length > 0 && (
              <ul
                data-testid="site-stats"
                aria-label={t("home.statsLabel")}
                data-reveal-group
                className="mt-2 grid w-full grid-cols-2 gap-y-6 sm:grid-cols-4 sm:divide-x sm:divide-line"
              >
                {about.stats.map((stat, position) => (
                  <li
                    key={position}
                    className="flex flex-col items-center gap-1.5 px-2 text-center"
                  >
                    <span className="mb-1 inline-flex size-14 items-center justify-center rounded-pill bg-primary-100/70 text-primary-700">
                      <SiteIcon name={stat.icon} className="size-6" />
                    </span>
                    <bdi className="text-title font-bold text-primary-900">{stat.value}</bdi>
                    <span className="text-meta text-ink-muted">{pick(stat.label, language)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
