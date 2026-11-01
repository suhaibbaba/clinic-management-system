import { SITE_SECTION } from "@clinic/shared";
import type { JSX } from "react";
import { cx } from "@web/booking/ui";
import { PillLink } from "@web/site/components/pill-link";
import { SectionHeading } from "@web/site/components/section-heading";
import { SiteImage } from "@web/site/components/site-image";
import { useSite } from "@web/site/hooks/use-site";
import { imageOf } from "@web/site/lib/images";
import { orDefault, pick } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

export function GallerySection(): JSX.Element | null {
  const { site, language, languages, t } = useSite();
  const { gallery } = site.content;
  const photos = gallery.images
    .map((key) => imageOf(site, key))
    .filter((url): url is string => url !== undefined);

  if (photos.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="site-gallery"
      className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)]"
    >
      <SectionHeading
        id="gallery"
        eyebrow={orDefault(gallery.eyebrow, language, t("home.galleryEyebrow"), languages)}
        title={orDefault(gallery.title, language, t("home.galleryTitle"), languages)}
        subtitle={pick(gallery.body, language, languages)}
      >
        {site.content.sections.includes(SITE_SECTION.ABOUT) && (
          <PillLink
            to={SITE_PATH.ABOUT}
            tone="outline"
            className="mt-4"
            data-testid="site-gallery-more"
          >
            {t("home.galleryLink")}
          </PillLink>
        )}
      </SectionHeading>
      <ul data-reveal-group className="grid grid-cols-3 gap-3">
        {photos.map((url, position) => (
          <li key={url}>
            <SiteImage
              src={url}
              className={cx(
                "aspect-[3/4] w-full rounded-panel shadow-card",
                position === 0 && "site-shape-soft",
              )}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
