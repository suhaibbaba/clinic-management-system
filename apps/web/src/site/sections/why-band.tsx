import type { JSX } from "react";
import { AccentRule } from "@web/site/components/accent-rule";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { Tagline } from "@web/site/components/tagline";
import { useSite } from "@web/site/hooks/use-site";
import { imageOf } from "@web/site/lib/images";
import { orDefault, pick } from "@web/site/lib/text";

export function WhyBand(): JSX.Element | null {
  const { site, language, t } = useSite();
  const { about, services } = site.content;

  if (about.values.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="site-why-band"
      aria-labelledby="why-band-title"
      className="mx-auto max-w-6xl px-4 py-14"
    >
      <div
        data-reveal
        className="site-panel-wash grid overflow-hidden rounded-card shadow-card lg:grid-cols-[minmax(0,1fr)_17rem]"
      >
        <div className="flex flex-col items-center gap-8 p-6 md:p-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2
              id="why-band-title"
              className="text-title font-bold text-primary-900 md:text-headline"
            >
              {orDefault(about.whyTitle, language, t("about.why"))}
            </h2>
            <AccentRule className="mt-1" />
          </div>
          <ul
            data-reveal-group
            className="grid w-full grid-cols-2 gap-y-8 md:grid-cols-4 md:divide-x md:divide-primary-200"
          >
            {about.values.map((value, position) => (
              <li key={position} className="flex flex-col items-center gap-2 px-3 text-center">
                <span className="mb-1 inline-flex size-14 items-center justify-center rounded-pill bg-surface text-primary-600 shadow-card">
                  <SiteIcon name={value.icon} className="size-7" />
                </span>
                <h3 className="text-section font-bold text-primary-900">
                  {pick(value.label, language)}
                </h3>
                {pick(value.text, language) && (
                  <p className="text-label text-ink-muted">{pick(value.text, language)}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative hidden min-h-56 lg:block">
          <SiteImage
            src={imageOf(site, services.promo.image) ?? imageOf(site, about.whyImage)}
            layer
            className="site-fade-start"
          />
          <Tagline className="absolute end-5 top-6" />
        </div>
      </div>
    </section>
  );
}
