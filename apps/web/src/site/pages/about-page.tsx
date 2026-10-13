import type { JSX } from "react";
import { AccentRule } from "@web/site/components/accent-rule";
import { PageHero } from "@web/site/components/page-hero";
import { PillLink } from "@web/site/components/pill-link";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { StatsList } from "@web/site/components/stats-list";
import { useBookable } from "@web/site/hooks/use-bookable";
import { useSite } from "@web/site/hooks/use-site";
import { imageOf } from "@web/site/lib/images";
import { orDefault, pick } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";
import { GallerySection } from "@web/site/sections/gallery-section";

export function AboutPage(): JSX.Element {
  const { site, language, t } = useSite();
  const { about } = site.content;
  const paragraphs = pick(about.body, language)
    .split(/\n{2,}/)
    .filter(Boolean);
  const note = pick(about.note, language);
  const whyBadge = pick(about.whyBadge, language);
  const quote = pick(about.quote.text, language);
  const ctaTitle = pick(about.cta.title, language);
  const bookable = useBookable();

  return (
    <>
      <PageHero
        id="about"
        eyebrow={pick(about.eyebrow, language)}
        title={orDefault(about.title, language, t("about.title"))}
        subtitle={pick(about.subtitle, language)}
        intro={paragraphs.join(" ")}
        image={imageOf(site, about.image)}
        tagline
      />

      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-4 py-12">
        {(about.pillars.length > 0 || note) && (
          <section
            data-testid="site-pillars"
            data-reveal
            className="grid items-center gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]"
          >
            {note && (
              <p className="flex items-center gap-4 text-title font-bold text-primary-900">
                <span aria-hidden className="flex flex-col items-center gap-2 text-primary-500">
                  <SiteIcon name="sparkles" className="size-5" />
                  <span className="h-12 w-0.5 rounded-pill bg-primary-500" />
                </span>
                {note}
              </p>
            )}
            <ul className="grid gap-8 sm:grid-cols-3 sm:divide-x sm:divide-line lg:col-start-2">
              {about.pillars.map((pillar, position) => (
                <li key={position} className="flex flex-col items-center gap-2 px-4 text-center">
                  <SiteIcon name={pillar.icon} className="size-10 text-primary-600" />
                  <h2 className="text-heading font-bold text-primary-900">
                    {pick(pillar.label, language)}
                  </h2>
                  {pick(pillar.text, language) && (
                    <p className="text-label text-ink-muted">{pick(pillar.text, language)}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {about.stats.length > 0 && (
          <section
            data-testid="site-stats"
            data-reveal
            className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]"
          >
            {about.statsImage && (
              <SiteImage
                src={imageOf(site, about.statsImage)}
                className="site-shape-soft min-h-56 w-full shadow-card"
              />
            )}
            <div className="flex items-center rounded-card border border-line bg-surface p-6 shadow-card md:p-8">
              <StatsList stats={about.stats} className="w-full" />
            </div>
          </section>
        )}

        {about.values.length > 0 && (
          <section
            data-testid="site-why"
            data-reveal
            aria-labelledby="why-title"
            className="grid items-stretch overflow-hidden rounded-card border border-line bg-surface shadow-card md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
          >
            <div className="flex flex-col gap-8 p-6 md:p-10">
              <div className="flex flex-col gap-2">
                <h2 id="why-title" className="text-headline font-bold text-primary-900">
                  {orDefault(about.whyTitle, language, t("about.why"))}
                </h2>
                <AccentRule className="mt-1" />
              </div>
              <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2">
                {about.values.map((value, position) => (
                  <li
                    key={position}
                    className="flex items-start gap-3 border-line sm:px-3 sm:odd:border-e"
                  >
                    <SiteIcon name={value.icon} className="size-9 shrink-0 text-primary-600" />
                    <span className="flex flex-col gap-1">
                      <span className="text-section font-bold text-primary-900">
                        {pick(value.label, language)}
                      </span>
                      {pick(value.text, language) && (
                        <span className="text-label text-ink-muted">
                          {pick(value.text, language)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative min-h-72">
              <SiteImage src={imageOf(site, about.whyImage)} layer className="site-fade-start" />
              {whyBadge && (
                <p className="absolute end-6 top-1/2 max-w-44 -translate-y-1/2 text-headline font-bold text-primary-900">
                  {whyBadge}
                  <AccentRule className="mt-3" />
                </p>
              )}
            </div>
          </section>
        )}

        {quote && (
          <figure
            data-testid="site-quote"
            data-reveal
            className="site-panel-wash flex items-center gap-5 rounded-card p-6 shadow-card md:p-10"
          >
            <SiteIcon name="quote" className="size-10 shrink-0 text-primary-500" />
            <blockquote className="text-title font-bold text-primary-900">{quote}</blockquote>
          </figure>
        )}
      </div>

      <GallerySection />

      {bookable && (ctaTitle || about.cta.image) && (
        <div className="mx-auto max-w-6xl px-4 pb-14">
          <section
            data-testid="site-about-cta"
            data-reveal
            className="site-panel-wash grid items-center gap-6 overflow-hidden rounded-card shadow-card md:grid-cols-[minmax(0,1fr)_auto_minmax(0,0.7fr)]"
          >
            <div className="flex flex-col gap-1 p-6 md:p-10">
              <p className="text-title font-bold text-primary-900 md:text-headline">{ctaTitle}</p>
              {pick(about.cta.subtitle, language) && (
                <p className="text-value text-ink-muted">{pick(about.cta.subtitle, language)}</p>
              )}
            </div>
            <div className="px-6 md:px-0">
              <PillLink to={SITE_PATH.BOOKING} size="lg" data-testid="site-about-book">
                {t("about.cta")}
              </PillLink>
            </div>
            <SiteImage
              src={imageOf(site, about.cta.image)}
              fit="contain"
              wash={false}
              className="hidden h-36 w-full mix-blend-multiply md:block md:h-full md:min-h-40"
            />
          </section>
        </div>
      )}
    </>
  );
}
