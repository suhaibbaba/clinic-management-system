import type { SITE_BLOCK_TYPE, SiteBlockOf, SitePageKind } from "@clinic/shared";
import type { JSX } from "react";
import { PageHeroFeatures } from "@web/site/blocks/page-hero-features";
import { PageHero } from "@web/site/components/page-hero";
import { useSite } from "@web/site/hooks/use-site";
import { imageOf } from "@web/site/lib/images";
import { pageHeroText } from "@web/site/lib/page-hero-text";
import { nameIn } from "@web/site/lib/text";

export function PageHeroBlock({
  block,
  kind,
}: {
  readonly block: SiteBlockOf<typeof SITE_BLOCK_TYPE.PAGE_HERO>;
  readonly kind: SitePageKind;
}): JSX.Element {
  const { site, language, languages, t } = useSite();
  const name = nameIn(site.clinic.name, language, languages);
  const text = pageHeroText(block, kind, name, language, languages, t);

  return (
    <PageHero {...text} image={imageOf(site, block.image)} tagline={block.tagline}>
      <PageHeroFeatures features={block.features} />
    </PageHero>
  );
}
