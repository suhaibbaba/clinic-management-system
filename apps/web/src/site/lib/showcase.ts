import type { PublicSite, SiteText } from "@clinic/shared";
import { imageOf } from "@web/site/lib/images";

export interface ShownCase {
  readonly before: string;
  readonly after: string;
  readonly title: SiteText;
}

export function completeCases(site: PublicSite): ShownCase[] {
  return site.content.cases.items.flatMap((item) => {
    const before = imageOf(site, item.before);
    const after = imageOf(site, item.after);

    return before && after ? [{ before, after, title: item.title }] : [];
  });
}
