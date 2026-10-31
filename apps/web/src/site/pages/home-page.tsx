import type { JSX } from "react";
import { AboutTeaser } from "@web/site/sections/about-teaser";
import { CasesSection } from "@web/site/sections/cases-section";
import { DoctorsTeaser } from "@web/site/sections/doctors-teaser";
import { HeroSection } from "@web/site/sections/hero-section";
import { ServicesTeaser } from "@web/site/sections/services-teaser";
import { TestimonialsSection } from "@web/site/sections/testimonials-section";

export function HomePage(): JSX.Element {
  return (
    <>
      <HeroSection />
      <ServicesTeaser />
      <AboutTeaser />
      <CasesSection />
      <DoctorsTeaser />
      <TestimonialsSection />
    </>
  );
}
