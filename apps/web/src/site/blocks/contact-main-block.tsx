import type { SITE_BLOCK_TYPE, SiteBlockOf } from "@clinic/shared";
import type { JSX } from "react";
import { cx } from "@web/booking/ui";
import { AccentRule } from "@web/site/components/accent-rule";
import { ContactCards } from "@web/site/components/contact-cards";
import { ContactForm } from "@web/site/components/contact-form";
import { SiteIcon } from "@web/site/components/site-icon";
import { MAP_SPAN } from "@web/site/constants";
import { useSite } from "@web/site/hooks/use-site";
import { mapEmbed, mapsLink, mapsSearchLink, nameIn, pick } from "@web/site/lib/text";

export function ContactMainBlock({
  block,
}: {
  readonly block: SiteBlockOf<typeof SITE_BLOCK_TYPE.CONTACT_MAIN>;
}): JSX.Element {
  const { site, language, languages, t } = useSite();
  const { clinic } = site;
  const name = nameIn(clinic.name, language, languages);
  const pin =
    clinic.latitude !== null && clinic.longitude !== null
      ? { lat: clinic.latitude, lng: clinic.longitude }
      : null;
  const note = pick(block.note, language, languages);
  const address = pick(clinic.address, language, languages);
  const map = mapEmbed(pin, address || null, MAP_SPAN);
  const directions = pin ? mapsLink(pin.lat, pin.lng) : address ? mapsSearchLink(address) : null;

  return (
    <>
      <div
        className={cx(
          "grid grid-cols-1 items-center gap-6",
          note && "lg:grid-cols-[14rem_minmax(0,1fr)]",
        )}
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
        {block.formEnabled && <ContactForm topics={block.topics} />}

        {map && (
          <div
            data-testid="site-map"
            className="flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card"
          >
            <iframe
              title={t("contact.map", { name })}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="site-placeholder block h-80 w-full flex-1 border-0 bg-primary-50 lg:h-auto lg:min-h-96"
              src={map}
            />
            <div className="flex flex-col items-start gap-1 p-5">
              <h2 className="text-heading font-bold text-primary-900">{t("contact.address")}</h2>
              {address && <p className="text-label text-ink-muted">{address}</p>}
              {directions && (
                <a
                  href={directions}
                  target="_blank"
                  rel="noreferrer noopener"
                  data-testid="site-map-directions"
                  className="mt-2 inline-flex items-center gap-1.5 text-label font-medium text-primary-700 hover:text-primary-900"
                >
                  <SiteIcon name="directions" className="size-4" />
                  {t("contact.directions")}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
