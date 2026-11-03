import { SITE_BLOCK_TYPE, type PublicSiteDoctor, type SiteBlock } from "@clinic/shared";
import type { JSX } from "react";
import { AboutPillarsBlockForm } from "@web/modules/website/components/blocks/about-pillars-block-form";
import { AboutTeaserBlockForm } from "@web/modules/website/components/blocks/about-teaser-block-form";
import { AboutValuesBlockForm } from "@web/modules/website/components/blocks/about-values-block-form";
import { BookingBlockForm } from "@web/modules/website/components/blocks/booking-block-form";
import { CasesBlockForm } from "@web/modules/website/components/blocks/cases-block-form";
import { ContactMainBlockForm } from "@web/modules/website/components/blocks/contact-main-block-form";
import { ContactWelcomeBlockForm } from "@web/modules/website/components/blocks/contact-welcome-block-form";
import { GalleryBlockForm } from "@web/modules/website/components/blocks/gallery-block-form";
import { HeadingBlockForm } from "@web/modules/website/components/blocks/heading-block-form";
import { HeroBlockForm } from "@web/modules/website/components/blocks/hero-block-form";
import { PageHeroBlockForm } from "@web/modules/website/components/blocks/page-hero-block-form";
import { TestimonialsBlockForm } from "@web/modules/website/components/blocks/testimonials-block-form";
import { DoctorsCollectionForm } from "@web/modules/website/components/doctors-collection-form";
import { EditorScope } from "@web/modules/website/components/editor-scope";
import { ServicesCollectionForm } from "@web/modules/website/components/services-collection-form";
import { DOCTORS_COLLECTION_PATH, SERVICES_COLLECTION_PATH } from "@web/modules/website/constants";

export function BlockForm({
  block,
  doctors,
}: {
  readonly block: SiteBlock;
  readonly doctors: readonly PublicSiteDoctor[];
}): JSX.Element {
  switch (block.type) {
    case SITE_BLOCK_TYPE.HERO:
      return <HeroBlockForm />;
    case SITE_BLOCK_TYPE.SERVICES_TEASER:
    case SITE_BLOCK_TYPE.DOCTORS_TEASER:
      return <HeadingBlockForm />;
    case SITE_BLOCK_TYPE.ABOUT_TEASER:
      return <AboutTeaserBlockForm />;
    case SITE_BLOCK_TYPE.CASES:
      return <CasesBlockForm />;
    case SITE_BLOCK_TYPE.TESTIMONIALS:
      return <TestimonialsBlockForm />;
    case SITE_BLOCK_TYPE.PAGE_HERO:
      return <PageHeroBlockForm />;
    case SITE_BLOCK_TYPE.SERVICES_GRID:
      return (
        <EditorScope path={SERVICES_COLLECTION_PATH} root>
          <ServicesCollectionForm />
        </EditorScope>
      );
    case SITE_BLOCK_TYPE.DOCTORS_GRID:
      return (
        <EditorScope path={DOCTORS_COLLECTION_PATH} root>
          <DoctorsCollectionForm doctors={doctors} />
        </EditorScope>
      );
    case SITE_BLOCK_TYPE.ABOUT_PILLARS:
      return <AboutPillarsBlockForm />;
    case SITE_BLOCK_TYPE.ABOUT_VALUES:
      return <AboutValuesBlockForm />;
    case SITE_BLOCK_TYPE.GALLERY:
      return <GalleryBlockForm />;
    case SITE_BLOCK_TYPE.CONTACT_MAIN:
      return <ContactMainBlockForm />;
    case SITE_BLOCK_TYPE.CONTACT_WELCOME:
      return <ContactWelcomeBlockForm />;
    case SITE_BLOCK_TYPE.BOOKING:
      return <BookingBlockForm />;
  }
}
