import type { JSX } from "react";
import { cx } from "@web/booking/ui";
import { AccentRule } from "@web/site/components/accent-rule";
import { ContactCards } from "@web/site/components/contact-cards";
import { ContactForm } from "@web/site/components/contact-form";
import { PageHero } from "@web/site/components/page-hero";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { Tagline } from "@web/site/components/tagline";
import { useHoursText } from "@web/site/hooks/use-hours-text";
import { useSite } from "@web/site/hooks/use-site";
import { imageOf } from "@web/site/lib/images";
import { mapsLink, nameIn, orDefault, pick } from "@web/site/lib/text";

const MAP_SPAN = 0.006;

export function ContactPage(): JSX.Element {
  const { site, language, t } = useSite();
  const { clinic, content } = site;
  const { contact } = content;
  const hours = useHoursText();
  const name = nameIn(clinic.name, language);
  const pin =
    clinic.latitude !== null && clinic.longitude !== null
      ? { lat: clinic.latitude, lng: clinic.longitude }
      : null;
  const note = pick(contact.note, language);

  return (
    <>
      <PageHero
        id="contact"
        title={orDefault(contact.title, language, t("contact.title"))}
        subtitle={orDefault(contact.subtitle, language, t("contact.subtitleDefault"))}
        intro={pick(contact.intro, language)}
        image={imageOf(site, contact.image)}
      />

      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12">
        <div
          className={cx("grid items-center gap-6", note && "lg:grid-cols-[14rem_minmax(0,1fr)]")}
        >
          {note && (
            <p
              className="flex flex-col gap-3 text-title font-bold text-primary-900 lg:text-headline"
              data-testid="site-contact-note"
            >
              {note}
              <AccentRule />
            </p>
          )}
          <ContactCards />
        </div>

        <div
          data-reveal-group
          className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]"
        >
          {contact.formEnabled && <ContactForm />}

          {pin && (
            <div
              data-testid="site-map"
              className="flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card"
            >
              <iframe
                title={t("contact.map", { name })}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="site-placeholder block h-80 w-full flex-1 border-0 bg-primary-50 lg:h-auto lg:min-h-96"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${[
                  pin.lng - MAP_SPAN,
                  pin.lat - MAP_SPAN,
                  pin.lng + MAP_SPAN,
                  pin.lat + MAP_SPAN,
                ].join("%2C")}&layer=mapnik&marker=${pin.lat}%2C${pin.lng}`}
              />
              <div className="flex flex-col items-start gap-1 p-5">
                <h2 className="text-heading font-bold text-primary-900">{t("contact.address")}</h2>
                {clinic.address && <p className="text-label text-ink-muted">{clinic.address}</p>}
                <a
                  href={mapsLink(pin.lat, pin.lng)}
                  target="_blank"
                  rel="noreferrer noopener"
                  data-testid="site-map-directions"
                  className="mt-2 inline-flex items-center gap-1.5 text-label font-medium text-primary-700 hover:text-primary-900"
                >
                  <SiteIcon name="directions" className="size-4" />
                  {t("contact.directions")}
                </a>
              </div>
            </div>
          )}
        </div>

        <div
          data-testid="site-welcome"
          data-reveal
          className="site-panel-wash grid items-stretch overflow-hidden rounded-card shadow-card md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.1fr)]"
        >
          <div className="flex flex-col justify-center gap-2 p-6 md:p-8">
            <p className="text-title font-bold text-primary-900 md:text-headline">
              {orDefault(contact.welcome, language, t("contact.welcome"))}
            </p>
            {pick(contact.welcomeBody, language) && (
              <p className="text-value text-ink-muted">{pick(contact.welcomeBody, language)}</p>
            )}
          </div>
          {hours && (
            <div className="flex items-center gap-4 p-6 md:p-8">
              <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-pill border border-primary-200 bg-surface text-primary-600 shadow-card">
                <SiteIcon name="clock" className="size-7" />
              </span>
              <div className="flex flex-col gap-0.5">
                <p className="text-heading font-bold text-primary-900">{t("contact.hours")}</p>
                <bdi className="text-label text-ink-muted tabular-nums">{hours.time}</bdi>
                <p className="text-label text-ink-muted">{hours.days}</p>
              </div>
            </div>
          )}
          <div className="relative min-h-48">
            <SiteImage
              src={imageOf(site, contact.welcomeImage)}
              layer
              className="site-fade-start"
            />
            <Tagline className="absolute end-5 top-5" />
          </div>
        </div>
      </div>
    </>
  );
}
