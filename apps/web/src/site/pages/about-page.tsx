import type { JSX } from "react";
import { AccentRule } from "@web/site/components/accent-rule";
import { PageHero } from "@web/site/components/page-hero";
import { SiteIcon } from "@web/site/components/site-icon";
import { useSite } from "@web/site/hooks/use-site";
import { imageOf } from "@web/site/lib/images";
import { orDefault, pick } from "@web/site/lib/text";
import { GallerySection } from "@web/site/sections/gallery-section";

export function AboutPage(): JSX.Element {
  const { site, language, languages, t } = useSite();
  const { about } = site.content;
  const paragraphs = pick(about.body, language, languages)
    .split(/\n{2,}/)
    .filter(Boolean);
  const note = pick(about.note, language, languages);

  return (
    <>
      <PageHero
        id="about"
        eyebrow={pick(about.eyebrow, language, languages)}
        title={orDefault(about.title, language, t("about.title"), languages)}
        subtitle={pick(about.subtitle, language, languages)}
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
                    {pick(pillar.label, language, languages)}
                  </h2>
                  {pick(pillar.text, language, languages) && (
                    <p className="text-label text-ink-muted">
                      {pick(pillar.text, language, languages)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {about.values.length > 0 && (
          <section
            data-testid="site-why"
            aria-labelledby="why-title"
            className="flex flex-col items-center gap-8"
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <h2 id="why-title" className="text-headline font-bold text-primary-900">
                {orDefault(about.whyTitle, language, t("about.why"), languages)}
              </h2>
              <AccentRule className="mt-1" />
            </div>
            <ul
              data-reveal-group
              className="grid w-full grid-cols-1 gap-y-5 rounded-card border border-line/70 bg-surface p-5 shadow-float sm:grid-cols-2 md:p-7 lg:grid-cols-4 lg:divide-x lg:divide-line"
            >
              {about.values.map((value, position) => {
                const text = pick(value.text, language, languages);

                return (
                  <li key={position} className="flex items-center gap-4 lg:px-5">
                    <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-pill bg-primary-50 text-primary-700">
                      <SiteIcon name={value.icon} className="size-7" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="text-section font-bold text-primary-900">
                        {pick(value.label, language, languages)}
                      </span>
                      {text && <span className="text-label text-ink-muted">{text}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      <GallerySection />
    </>
  );
}
