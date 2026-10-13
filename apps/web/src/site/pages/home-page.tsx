import type { JSX } from "react";
import { StoryBanner } from "@web/site/components/story-banner";
import { useBookable } from "@web/site/hooks/use-bookable";
import { AboutTeaser } from "@web/site/sections/about-teaser";
import { ContactTeaser } from "@web/site/sections/contact-teaser";
import { DoctorsTeaser } from "@web/site/sections/doctors-teaser";
import { GallerySection } from "@web/site/sections/gallery-section";
import { HeroSection } from "@web/site/sections/hero-section";
import { ServicesTeaser } from "@web/site/sections/services-teaser";
import { StatsBand } from "@web/site/sections/stats-band";
import { WhyBand } from "@web/site/sections/why-band";

export function HomePage(): JSX.Element {
  const bookable = useBookable();

  return (
    <>
      <HeroSection />
      <StatsBand />
      <AboutTeaser />
      <ServicesTeaser />
      <WhyBand />
      <DoctorsTeaser />
      <GallerySection />
      <ContactTeaser />
      {bookable && <StoryBanner />}
    </>
  );
}
