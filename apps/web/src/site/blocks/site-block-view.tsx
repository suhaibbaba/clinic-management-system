import { SITE_BLOCK_TYPE, type SiteBlock, type SitePageKind } from "@clinic/shared";
import type { JSX } from "react";
import { AboutPillarsBlock } from "@web/site/blocks/about-pillars-block";
import { AboutValuesBlock } from "@web/site/blocks/about-values-block";
import { BookingBlock } from "@web/site/blocks/booking-block";
import { ContactMainBlock } from "@web/site/blocks/contact-main-block";
import { ContactWelcomeBlock } from "@web/site/blocks/contact-welcome-block";
import { DoctorsGridBlock } from "@web/site/blocks/doctors-grid-block";
import { PageHeroBlock } from "@web/site/blocks/page-hero-block";
import { ServicesGridBlock } from "@web/site/blocks/services-grid-block";
import { AboutTeaser } from "@web/site/sections/about-teaser";
import { CasesSection } from "@web/site/sections/cases-section";
import { DoctorsTeaser } from "@web/site/sections/doctors-teaser";
import { GallerySection } from "@web/site/sections/gallery-section";
import { HeroSection } from "@web/site/sections/hero-section";
import { ServicesTeaser } from "@web/site/sections/services-teaser";
import { TestimonialsSection } from "@web/site/sections/testimonials-section";

export function SiteBlockView({
  block,
  kind,
}: {
  readonly block: SiteBlock;
  readonly kind: SitePageKind;
}): JSX.Element | null {
  switch (block.type) {
    case SITE_BLOCK_TYPE.HERO:
      return <HeroSection block={block} />;
    case SITE_BLOCK_TYPE.SERVICES_TEASER:
      return <ServicesTeaser block={block} />;
    case SITE_BLOCK_TYPE.ABOUT_TEASER:
      return <AboutTeaser block={block} />;
    case SITE_BLOCK_TYPE.CASES:
      return <CasesSection block={block} />;
    case SITE_BLOCK_TYPE.DOCTORS_TEASER:
      return <DoctorsTeaser block={block} />;
    case SITE_BLOCK_TYPE.TESTIMONIALS:
      return <TestimonialsSection block={block} />;
    case SITE_BLOCK_TYPE.PAGE_HERO:
      return <PageHeroBlock block={block} kind={kind} />;
    case SITE_BLOCK_TYPE.SERVICES_GRID:
      return <ServicesGridBlock />;
    case SITE_BLOCK_TYPE.DOCTORS_GRID:
      return <DoctorsGridBlock />;
    case SITE_BLOCK_TYPE.ABOUT_PILLARS:
      return <AboutPillarsBlock block={block} />;
    case SITE_BLOCK_TYPE.ABOUT_VALUES:
      return <AboutValuesBlock block={block} />;
    case SITE_BLOCK_TYPE.GALLERY:
      return <GallerySection block={block} />;
    case SITE_BLOCK_TYPE.CONTACT_MAIN:
      return <ContactMainBlock block={block} />;
    case SITE_BLOCK_TYPE.CONTACT_WELCOME:
      return <ContactWelcomeBlock block={block} />;
    case SITE_BLOCK_TYPE.BOOKING:
      return <BookingBlock block={block} />;
  }
}
