import {
  contentToDocument,
  defaultSiteContent,
  defaultSiteDocument,
  readSiteDocument,
  SITE_BLOCK_TYPE,
  SITE_PAGE_KIND,
  SITE_SECTION,
  siteBlock,
  siteDocumentImageKeys,
  siteDocumentSchema,
  siteImageKeys,
  sitePageEnabled,
  type SiteContent,
} from "@clinic/shared";
import { describe, expect, it } from "vitest";

const filled = (): SiteContent => {
  const content = defaultSiteContent();

  return {
    ...content,
    sections: [SITE_SECTION.SERVICES, SITE_SECTION.ABOUT, SITE_SECTION.PORTAL],
    brand: {
      tagline: { ar: "ابتسامتك" },
      social: { ...content.brand.social, instagram: "https://instagram.com/x" },
    },
    hero: {
      title: { ar: "ابتسامة صحية" },
      subtitle: { ar: "رعاية" },
      images: ["hero-1", "hero-2"],
      stat: { value: "12k", label: { ar: "مريض" } },
    },
    story: {
      eyebrow: { ar: "قصتنا" },
      title: { ar: "منذ" },
      badge: { ar: "2004" },
      image: "story",
    },
    services: {
      ...content.services,
      title: { ar: "خدماتنا" },
      image: "services",
      items: [
        { id: "clean", title: { ar: "تنظيف" }, description: {}, image: "clean", icon: "tooth" },
      ],
      promo: { title: { ar: "عرض" }, image: "services-promo" },
    },
    doctors: { ...content.doctors, image: "doctors", promo: { title: {}, image: "doctors-promo" } },
    about: {
      ...content.about,
      image: "about",
      statsImage: "stats",
      whyImage: "why",
      quote: { text: { ar: "اقتباس" }, image: "quote" },
      cta: { title: { ar: "احجز" }, subtitle: {}, image: "cta" },
    },
    gallery: { ...content.gallery, images: ["g-1"] },
    cases: { ...content.cases, items: [{ before: "before", after: "after", title: {} }] },
    booking: { ...content.booking, image: "booking" },
    contact: {
      ...content.contact,
      image: "contact",
      welcomeImage: "welcome",
      topics: [{ ar: "سعر" }],
    },
  };
};

describe("contentToDocument", () => {
  it("turns the default content into a valid document of the six system pages", () => {
    const document = contentToDocument(defaultSiteContent());

    expect(siteDocumentSchema.safeParse(document).success).toBe(true);
    expect(document.pages.map((page) => page.kind)).toEqual(Object.values(SITE_PAGE_KIND));
  });

  it("keeps every image the content referenced", () => {
    const content = filled();
    const document = contentToDocument(content);

    expect(siteDocumentSchema.safeParse(document).success).toBe(true);
    expect(new Set(siteDocumentImageKeys(document))).toEqual(new Set(siteImageKeys(content)));
  });

  it("turns the section switches into enabled pages and the portal flag", () => {
    const document = contentToDocument(filled());

    expect(sitePageEnabled(document, SITE_PAGE_KIND.HOME)).toBe(true);
    expect(sitePageEnabled(document, SITE_PAGE_KIND.SERVICES)).toBe(true);
    expect(sitePageEnabled(document, SITE_PAGE_KIND.ABOUT)).toBe(true);
    expect(sitePageEnabled(document, SITE_PAGE_KIND.DOCTORS)).toBe(false);
    expect(sitePageEnabled(document, SITE_PAGE_KIND.BOOKING)).toBe(false);
    expect(document.portal).toBe(true);
  });

  it("puts each section's words into its block", () => {
    const content = filled();
    const document = contentToDocument(content);

    expect(siteBlock(document, SITE_BLOCK_TYPE.HERO)).toMatchObject({
      eyebrow: content.story.eyebrow,
      title: content.hero.title,
      stat: content.hero.stat,
    });
    expect(siteBlock(document, SITE_BLOCK_TYPE.ABOUT_TEASER)).toMatchObject({
      eyebrow: content.about.title,
      title: content.story.title,
      image: "about",
      storyImage: "story",
    });
    expect(siteBlock(document, SITE_BLOCK_TYPE.CONTACT_MAIN)?.topics).toEqual(
      content.contact.topics,
    );
    expect(document.bookingBand).toEqual(content.about.cta);
    expect(document.brand).toEqual(content.brand);
  });

  it("reads a stored row in either shape", () => {
    const content = filled();
    const document = contentToDocument(content);
    const moved = { ...document, pages: [...document.pages].reverse() };

    expect(readSiteDocument(content)).toEqual(siteDocumentSchema.parse(document));
    expect(readSiteDocument(moved).pages.map((page) => page.kind)).toEqual(
      moved.pages.map((page) => page.kind),
    );
    expect(readSiteDocument({ sections: ["nowhere"] })).toEqual(defaultSiteDocument());
    expect(readSiteDocument({ pages: [{ kind: "nowhere" }] })).toEqual(defaultSiteDocument());
    expect(readSiteDocument(null)).toEqual(defaultSiteDocument());
  });
});
