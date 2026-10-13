import type { JSX } from "react";
import { BookingWizard } from "@web/booking/booking-wizard";
import { SectionHeading } from "@web/site/components/section-heading";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { SITE_PARAM } from "@web/site/constants";
import { useSite } from "@web/site/hooks/use-site";
import { imageOf } from "@web/site/lib/images";
import { orDefault } from "@web/site/lib/text";

export function BookingPage(): JSX.Element {
  const { site, language, t, params } = useSite();
  const { booking } = site.content;
  const image = imageOf(site, booking.image);
  const doctorId = params.get(SITE_PARAM.DOCTOR) ?? undefined;

  return (
    <section data-testid="site-booking" aria-labelledby="booking-title" className="site-wash">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <SectionHeading
          id="booking"
          align="center"
          level={1}
          title={orDefault(booking.title, language, t("booking.title"))}
          subtitle={orDefault(booking.subtitle, language, t("booking.subtitle"))}
        />

        <div className="mt-10 grid grid-cols-1 overflow-hidden rounded-card border border-line bg-surface shadow-card md:grid-cols-[minmax(0,1fr)_20rem]">
          <div dir="rtl" lang="ar" className="p-5 md:p-8">
            {site.clinic.bookingEnabled ? (
              <BookingWizard
                key={doctorId ?? ""}
                slug={site.clinic.slug}
                inline
                initialDoctorId={doctorId}
              />
            ) : (
              <p data-testid="site-booking-closed" className="text-value text-ink-muted">
                {t("booking.closed")}
              </p>
            )}
          </div>
          <aside className="site-panel-wash relative hidden flex-col justify-end md:flex">
            <SiteImage
              src={image}
              layer
              fallback={<SiteIcon name="calendar" className="size-16" />}
            />
            <p className="relative m-4 flex flex-col gap-2 rounded-panel bg-surface/90 p-5 text-heading font-bold text-primary-900 backdrop-blur">
              <SiteIcon name="sparkles" className="size-5 text-primary-500" />
              {t("booking.aside")}
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
