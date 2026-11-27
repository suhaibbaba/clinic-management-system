import type { JSX } from "react";
import { cx } from "@web/booking/ui";
import { FooterBasin, FooterCurtain, FooterSmile } from "@web/site/components/footer-curves";
import { FooterMark } from "@web/site/components/footer-mark";
import { PillLink } from "@web/site/components/pill-link";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { useBookable } from "@web/site/hooks/use-bookable";
import { useSite } from "@web/site/hooks/use-site";
import { imageOf } from "@web/site/lib/images";
import { orDefault, pick } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

export function BookingBand(): JSX.Element {
  const { site, siteDocument, language, languages, t } = useSite();
  const cta = siteDocument.bookingBand;
  const bookable = useBookable();
  const image = imageOf(site, cta.image);

  return (
    <section
      data-testid="site-booking-band"
      aria-labelledby="booking-band-title"
      className="relative isolate overflow-hidden bg-surface lg:flex lg:min-h-80 lg:items-center"
    >
      <div className={cx("relative z-10", image && "lg:w-[56%]", !image && "lg:w-full")}>
        <FooterCurtain className="site-footer-curtain inset-x-0 lg:hidden" />
        <FooterMark className="absolute start-[2.5%] top-14 h-auto w-[16.5%] max-w-40 max-[22.4rem]:hidden sm:start-[6%] lg:start-[3%] lg:top-1/2 lg:w-[11%] lg:max-w-32 lg:-translate-y-1/2 lg:opacity-70" />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pt-8 pb-4 text-center lg:py-12">
          <h2
            id="booking-band-title"
            className="site-footer-title max-w-[80%] pb-1 text-title font-bold min-[30rem]:text-headline sm:text-hero"
          >
            {orDefault(cta.title, language, t("home.ctaTitle"), languages)}
          </h2>
          <FooterSmile className="mt-1 h-2.5 w-24 sm:h-4 sm:w-40" />
          <p className="mt-4 max-w-64 text-field text-balance text-ink-muted sm:mt-5 sm:max-w-md sm:text-title">
            {pick(cta.subtitle, language, languages) || t("home.ctaSubtitle")}
          </p>
          {bookable && (
            <PillLink
              to={SITE_PATH.BOOKING}
              tone="gradient"
              size="lg"
              className="mt-5 w-[58%] max-w-80 min-w-56"
              data-testid="site-booking-band-book"
            >
              <SiteIcon name="calendar" className="size-5" />
              <span aria-hidden className="h-5 w-px bg-ink-inverse/70" />
              <span className="flex-1 font-bold">{t("services.promoCta")}</span>
            </PillLink>
          )}
        </div>
      </div>
      <div
        className={cx(
          "relative",
          image
            ? "site-footer-photo lg:absolute lg:inset-y-0 lg:end-0 lg:h-auto lg:w-[46%]"
            : "site-footer-gap lg:hidden",
        )}
      >
        {image && (
          <span aria-hidden className="site-booking-rim absolute inset-0 hidden lg:block" />
        )}
        <div className="site-footer-photo-frame lg:site-booking-arc absolute inset-x-0 bottom-0 lg:top-0">
          {image && <SiteImage src={image} layer data-testid="site-booking-band-image" />}
        </div>
        {image && <FooterBasin className="site-footer-basin inset-x-0 -bottom-px lg:hidden" />}
      </div>
    </section>
  );
}
