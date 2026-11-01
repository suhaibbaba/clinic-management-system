import { languageDirection } from "@clinic/shared";
import type { JSX } from "react";
import { BookingWizard } from "@web/booking/booking-wizard";
import { SectionHeading } from "@web/site/components/section-heading";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { SITE_PARAM } from "@web/site/constants";
import { usePortal } from "@web/site/hooks/use-portal";
import { useSite } from "@web/site/hooks/use-site";
import { imageOf } from "@web/site/lib/images";
import { orDefault } from "@web/site/lib/text";

export function BookingPage(): JSX.Element {
  const { site, language, languages, t, params } = useSite();
  const portal = usePortal();
  const signedIn = portal.state.status === "ready" ? portal.state.account : undefined;
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
          title={orDefault(booking.title, language, t("booking.title"), languages)}
          subtitle={orDefault(booking.subtitle, language, t("booking.subtitle"), languages)}
        />

        <div
          aria-hidden
          className="mt-8 flex items-center gap-4 overflow-hidden rounded-card border border-line bg-surface shadow-card"
        >
          <SiteImage
            src={image}
            className="h-24 w-36 shrink-0 sm:w-48"
            fallback={<SiteIcon name="calendar" className="size-10" />}
          />
          <p className="flex items-center gap-2 py-4 pe-5 text-heading font-bold text-primary-900">
            <SiteIcon name="sparkles" className="size-5 text-primary-500" />
            {t("booking.aside")}
          </p>
        </div>

        <div dir={languageDirection(language)} lang={language} className="mt-6">
          {site.clinic.bookingEnabled ? (
            <BookingWizard
              key={`${doctorId ?? ""}-${signedIn ? "account" : "guest"}`}
              slug={site.clinic.slug}
              inline
              language={language}
              initialDoctorId={doctorId}
              account={signedIn && { patients: signedIn.patients, onBooked: portal.refresh }}
            />
          ) : (
            <p
              data-testid="site-booking-closed"
              className="rounded-card border border-line bg-surface p-6 text-value text-ink-muted"
            >
              {t("booking.closed")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
