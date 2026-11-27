import type { JSX } from "react";
import { FooterContacts } from "@web/site/components/footer-contacts";
import { FooterRibbon } from "@web/site/components/footer-curves";
import { SiteLogo } from "@web/site/components/site-logo";
import { SocialLinks } from "@web/site/components/social-links";
import { useSite } from "@web/site/hooks/use-site";
import { nameIn } from "@web/site/lib/text";
import { BookingBand } from "@web/site/sections/booking-band";

export function SiteFooter(): JSX.Element {
  const { site, language, languages, t } = useSite();
  const name = nameIn(site.clinic.name, language, languages);

  return (
    <footer data-testid="site-footer" className="site-footer text-ink-inverse">
      <BookingBand />
      <div className="mx-auto flex max-w-md flex-col items-center px-6 pt-3 lg:max-w-6xl lg:flex-row-reverse lg:justify-between lg:gap-6 lg:px-10 lg:pt-8 lg:pb-6">
        <div className="lg:shrink-0">
          <SiteLogo url={site.clinic.logoUrl} name={name} size="footer" />
        </div>
        <FooterContacts className="mt-3 w-full border-y border-ink-inverse/80 px-2 py-4 sm:px-7 lg:mt-0 lg:w-auto lg:flex-1 lg:border-x lg:border-y-0 lg:border-ink-inverse/30 lg:px-0 lg:py-1" />
        <div className="mt-5 lg:mt-0 lg:shrink-0">
          <SocialLinks tone="outline" />
        </div>
      </div>
      <div className="site-footer-base relative isolate mt-3 overflow-hidden lg:mt-0 lg:px-10">
        <FooterRibbon className="site-footer-ribbon inset-x-0 top-0 -z-10 lg:hidden" />
        <p
          data-testid="site-footer-rights"
          className="site-footer-rights px-6 pb-7 text-center text-label sm:text-field lg:mx-auto lg:max-w-6xl lg:border-t lg:border-ink-inverse/30 lg:pt-4 lg:pb-5 lg:text-value"
        >
          {t("footer.rights", { year: new Date().getFullYear(), name })}
        </p>
      </div>
    </footer>
  );
}
