import { clinicLocale, defaultSiteContent, type PublicSite } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { translator } from "@web/site/i18n";
import { pageTitle } from "@web/site/lib/page-title";

const DOCTOR = "b9a5f260-c1f6-4f31-bbae-7cbf2c4a7205";

const site = (): PublicSite => {
  const content = defaultSiteContent();
  content.hero.title = { ar: "ابتسامة لصحة أفضل", en: "" };

  return {
    clinic: {
      name: { ar: "عيادة الاختبار", en: "Test Clinic" },
      slug: "test",
      logoUrl: null,
      phone: null,
      country: "PS",
      email: null,
      address: null,
      latitude: null,
      longitude: null,
      workingHours: [],
      bookingEnabled: true,
      chartTypes: [],
      locale: clinicLocale({ country: "PS" }),
    },
    doctors: [{ id: DOCTOR, name: { ar: "باسل", en: "Basel" }, specialty: "", photoUrl: null }],
    content,
    images: {},
  };
};

describe("site page title", () => {
  const t = translator("ar");

  it("names each page, then the clinic", () => {
    expect(pageTitle(site(), { kind: "home" }, "ar", t)).toBe("ابتسامة لصحة أفضل — عيادة الاختبار");
    expect(pageTitle(site(), { kind: "contact" }, "ar", t)).toBe("تواصل معنا — عيادة الاختبار");
    expect(pageTitle(site(), { kind: "doctor", id: DOCTOR }, "ar", t)).toBe(
      "باسل — عيادة الاختبار",
    );
  });

  it("falls back to the clinic name alone when a page has no heading", () => {
    const blank = site();
    blank.content.hero.title = { ar: "", en: "" };

    expect(pageTitle(blank, { kind: "home" }, "en", translator("en"))).toBe("Test Clinic");
  });
});
