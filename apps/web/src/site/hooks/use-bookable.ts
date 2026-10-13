import { SITE_SECTION } from "@clinic/shared";
import { useSite } from "@web/site/hooks/use-site";

export function useBookable(): boolean {
  const { site } = useSite();

  return site.clinic.bookingEnabled && site.content.sections.includes(SITE_SECTION.BOOKING);
}
