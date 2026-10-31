import type { JSX } from "react";
import { BookingBand } from "@web/site/sections/booking-band";
import { SocialLinks } from "@web/site/components/social-links";
import { useSite } from "@web/site/hooks/use-site";
import { nameIn } from "@web/site/lib/text";

export function SiteFooter(): JSX.Element {
  const { site, language, t } = useSite();
  const name = nameIn(site.clinic.name, language);

  return (
    <footer data-testid="site-footer" className="bg-primary-50">
      <BookingBand />
      <div className="mx-auto flex max-w-6xl flex-col-reverse items-center gap-4 px-4 pt-1 pb-6 sm:flex-row sm:justify-between">
        <p className="text-center text-meta text-ink-subtle">
          {t("footer.rights", { year: new Date().getFullYear(), name })}
        </p>
        <SocialLinks />
      </div>
    </footer>
  );
}
