import { defaultSiteContent, type PublicSite } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { completeCases } from "@web/site/lib/showcase";

const title = { ar: "تبييض", en: "Whitening" };

function siteWith(cases: PublicSite["content"]["cases"]["items"]): PublicSite {
  const content = defaultSiteContent();

  return {
    clinic: {} as PublicSite["clinic"],
    doctors: [],
    content: { ...content, cases: { ...content.cases, items: cases } },
    images: { b: "https://files.test/b.jpg", a: "https://files.test/a.jpg" },
  };
}

describe("before and after cases", () => {
  it("shows only a case whose two photos both resolve", () => {
    const site = siteWith([
      { title, before: "b", after: "a" },
      { title, before: "b", after: null },
      { title, before: "b", after: "missing" },
    ]);

    expect(completeCases(site)).toEqual([
      { title, before: "https://files.test/b.jpg", after: "https://files.test/a.jpg" },
    ]);
  });
});
