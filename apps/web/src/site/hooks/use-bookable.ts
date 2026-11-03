import { SITE_PAGE_KIND, sitePageEnabled } from "@clinic/shared";
import { useSite } from "@web/site/hooks/use-site";

export function useBookable(): boolean {
  const { site, siteDocument } = useSite();

  return site.clinic.bookingEnabled && sitePageEnabled(siteDocument, SITE_PAGE_KIND.BOOKING);
}
