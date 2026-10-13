import { SITE_SECTION } from "@clinic/shared";
import type { JSX } from "react";
import { PillLink } from "@web/site/components/pill-link";
import { SectionHeading } from "@web/site/components/section-heading";
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
  const pillars = about.pillars.slice(0, 3);

  if (!site.content.sections.includes(SITE_SECTION.ABOUT)) {
    return null;
  }

  return (
    <section
      data-testid="site-about-teaser"
      className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]"
    >
      <div className="flex flex-col gap-6">
        <SectionHeading
          id="about-teaser"
          eyebrow={orDefault(about.title, language, t("about.title"))}
          title={orDefault(story.title, language, t("about.subtitle"))}
        >
          {summary && <p className="mt-2 line-clamp-4 text-section text-ink-muted">{summary}</p>}
        </SectionHeading>

        {pillars.length > 0 && (
          <ul
            data-reveal-group
            className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]"
          >
            {pillars.map((pillar, position) => (
              <li
                key={position}
                className="flex flex-col items-center gap-2 rounded-card border border-line bg-surface p-5 text-center shadow-card"
              >
                <SiteIcon name={pillar.icon} className="size-8 text-primary-600" />
                <h3 className="text-heading font-bold text-primary-900">
                  {pick(pillar.label, language)}
                </h3>
                {pick(pillar.text, language) && (
                  <p className="text-label text-ink-muted">{pick(pillar.text, language)}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        <PillLink
          to={SITE_PATH.ABOUT}
          tone="outline"
          className="self-start"
          data-testid="site-about-more"
        >
          {t("home.aboutLink")}
        </PillLink>
      </div>

      <div data-reveal>
        <SiteImage
          src={imageOf(site, about.image) ?? imageOf(site, story.image)}
          data-testid="site-about-teaser-image"
          className="site-shape-soft aspect-[4/3] w-full shadow-float lg:aspect-[5/4]"
          fallback={<SiteIcon name="smile" className="size-16" />}
        />
      </div>
    </section>
  );
}
