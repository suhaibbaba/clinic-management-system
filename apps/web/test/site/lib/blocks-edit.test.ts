import {
  blockActions,
  defaultSiteDocument,
  duplicateBlock,
  insertableBlocks,
  insertBlock,
  INSERTABLE_SITE_BLOCKS,
  isFixedSiteBlock,
  moveBlock,
  newBlock,
  removeBlock,
  setPageEnabled,
  SITE_BLOCK_TYPE,
  SITE_PAGE_BLOCKS_MAX,
  SITE_PAGE_KIND,
  siteBlockSchema,
  siteDocumentPage,
  siteDocumentSchema,
  updateBlock,
  type SiteDocument,
  type SitePageKind,
} from "@clinic/shared";
import { describe, expect, it } from "vitest";

const ids = (document: SiteDocument, kind: SitePageKind): string[] =>
  siteDocumentPage(document, kind)?.blocks.map((block) => block.id) ?? [];

describe("newBlock", () => {
  it("makes a valid empty block for every type", () => {
    for (const type of Object.values(SITE_BLOCK_TYPE)) {
      expect(siteBlockSchema.safeParse(newBlock(type, [])).success).toBe(true);
    }
  });

  it("names the id after the type in kebab case and keeps it unique", () => {
    expect(newBlock(SITE_BLOCK_TYPE.SERVICES_TEASER, []).id).toBe("services-teaser");
    expect(newBlock(SITE_BLOCK_TYPE.CASES, ["cases"]).id).toBe("cases-2");
    expect(newBlock(SITE_BLOCK_TYPE.CASES, ["cases", "cases-2"]).id).toBe("cases-3");
  });
});

describe("insertableBlocks", () => {
  it("offers only the blocks that are not fixed", () => {
    expect(insertableBlocks(SITE_PAGE_KIND.HOME)).toEqual(INSERTABLE_SITE_BLOCKS);
    expect(INSERTABLE_SITE_BLOCKS.some(isFixedSiteBlock)).toBe(false);
    expect(INSERTABLE_SITE_BLOCKS).toHaveLength(9);
  });

  it("offers nothing on the booking page", () => {
    expect(insertableBlocks(SITE_PAGE_KIND.BOOKING)).toEqual([]);
  });
});

describe("insertBlock", () => {
  it("inserts at the index", () => {
    const document = defaultSiteDocument();
    const block = newBlock(SITE_BLOCK_TYPE.GALLERY, ids(document, SITE_PAGE_KIND.HOME));
    const next = insertBlock(document, SITE_PAGE_KIND.HOME, 2, block);

    expect(ids(next, SITE_PAGE_KIND.HOME)[2]).toBe("gallery");
    expect(siteDocumentSchema.safeParse(next).success).toBe(true);
  });

  it("keeps the hero first", () => {
    const document = defaultSiteDocument();
    const next = insertBlock(
      document,
      SITE_PAGE_KIND.SERVICES,
      0,
      newBlock(SITE_BLOCK_TYPE.CASES, []),
    );

    expect(ids(next, SITE_PAGE_KIND.SERVICES)).toEqual(["page-hero", "cases", "services-grid"]);
  });

  it("refuses fixed blocks, duplicate ids, the booking page and a full page", () => {
    const document = defaultSiteDocument();

    expect(insertBlock(document, SITE_PAGE_KIND.HOME, 1, newBlock(SITE_BLOCK_TYPE.HERO, []))).toBe(
      document,
    );
    expect(insertBlock(document, SITE_PAGE_KIND.HOME, 1, newBlock(SITE_BLOCK_TYPE.CASES, []))).toBe(
      document,
    );
    expect(
      insertBlock(document, SITE_PAGE_KIND.BOOKING, 1, newBlock(SITE_BLOCK_TYPE.GALLERY, [])),
    ).toBe(document);

    let full = document;
    while (ids(full, SITE_PAGE_KIND.ABOUT).length < SITE_PAGE_BLOCKS_MAX) {
      full = insertBlock(
        full,
        SITE_PAGE_KIND.ABOUT,
        1,
        newBlock(SITE_BLOCK_TYPE.GALLERY, ids(full, SITE_PAGE_KIND.ABOUT)),
      );
    }

    expect(
      insertBlock(full, SITE_PAGE_KIND.ABOUT, 1, newBlock(SITE_BLOCK_TYPE.GALLERY, ["x"])),
    ).toBe(full);
  });
});

describe("moveBlock", () => {
  it("moves a block up and down", () => {
    const document = defaultSiteDocument();
    const down = moveBlock(document, SITE_PAGE_KIND.HOME, "services-teaser", 1);

    expect(ids(down, SITE_PAGE_KIND.HOME).slice(0, 3)).toEqual([
      "hero",
      "about-teaser",
      "services-teaser",
    ]);
    expect(moveBlock(down, SITE_PAGE_KIND.HOME, "services-teaser", -1)).toEqual(document);
  });

  it("never moves above the hero, past the end, or a fixed block", () => {
    const document = defaultSiteDocument();

    expect(moveBlock(document, SITE_PAGE_KIND.HOME, "services-teaser", -1)).toBe(document);
    expect(moveBlock(document, SITE_PAGE_KIND.HOME, "testimonials", 1)).toBe(document);
    expect(moveBlock(document, SITE_PAGE_KIND.HOME, "hero", 1)).toBe(document);
    expect(moveBlock(document, SITE_PAGE_KIND.CONTACT, "contact-main", 1)).toBe(document);
  });
});

describe("duplicateBlock", () => {
  it("copies a block right after itself with a new id", () => {
    const next = duplicateBlock(defaultSiteDocument(), SITE_PAGE_KIND.ABOUT, "gallery");

    expect(ids(next, SITE_PAGE_KIND.ABOUT).slice(-2)).toEqual(["gallery", "gallery-2"]);
    expect(siteDocumentSchema.safeParse(next).success).toBe(true);
  });

  it("refuses fixed blocks", () => {
    const document = defaultSiteDocument();

    expect(duplicateBlock(document, SITE_PAGE_KIND.SERVICES, "services-grid")).toBe(document);
    expect(duplicateBlock(document, SITE_PAGE_KIND.HOME, "hero")).toBe(document);
  });
});

describe("removeBlock", () => {
  it("removes a block", () => {
    const next = removeBlock(defaultSiteDocument(), SITE_PAGE_KIND.HOME, "cases");

    expect(ids(next, SITE_PAGE_KIND.HOME)).not.toContain("cases");
  });

  it("refuses fixed blocks and unknown ids", () => {
    const document = defaultSiteDocument();

    expect(removeBlock(document, SITE_PAGE_KIND.CONTACT, "contact-main")).toBe(document);
    expect(removeBlock(document, SITE_PAGE_KIND.BOOKING, "booking")).toBe(document);
    expect(removeBlock(document, SITE_PAGE_KIND.HOME, "missing")).toBe(document);
  });
});

describe("updateBlock", () => {
  it("merges the patch and keeps id and type", () => {
    const next = updateBlock(defaultSiteDocument(), SITE_PAGE_KIND.HOME, "cases", {
      title: { en: "Cases" },
    });
    const cases = siteDocumentPage(next, SITE_PAGE_KIND.HOME)?.blocks.find(
      (block) => block.id === "cases",
    );

    expect(cases).toMatchObject({
      id: "cases",
      type: SITE_BLOCK_TYPE.CASES,
      title: { en: "Cases" },
    });
  });

  it("updates fixed blocks too", () => {
    const next = updateBlock(defaultSiteDocument(), SITE_PAGE_KIND.HOME, "hero", {
      title: { ar: "أهلاً" },
    });

    expect(siteDocumentPage(next, SITE_PAGE_KIND.HOME)?.blocks[0]).toMatchObject({
      title: { ar: "أهلاً" },
    });
  });

  it("leaves the document when the block is missing", () => {
    const document = defaultSiteDocument();

    expect(updateBlock(document, SITE_PAGE_KIND.HOME, "missing", { title: {} })).toBe(document);
  });
});

describe("setPageEnabled", () => {
  it("switches a page", () => {
    const next = setPageEnabled(defaultSiteDocument(), SITE_PAGE_KIND.ABOUT, false);

    expect(siteDocumentPage(next, SITE_PAGE_KIND.ABOUT)?.enabled).toBe(false);
  });

  it("never switches the home page off", () => {
    const document = defaultSiteDocument();

    expect(setPageEnabled(document, SITE_PAGE_KIND.HOME, false)).toBe(document);
  });
});

describe("blockActions", () => {
  it("allows nothing on a fixed block", () => {
    expect(blockActions(defaultSiteDocument(), SITE_PAGE_KIND.HOME, "hero")).toEqual({
      up: false,
      down: false,
      duplicate: false,
      remove: false,
    });
  });

  it("allows moving only where there is room", () => {
    const document = defaultSiteDocument();

    expect(blockActions(document, SITE_PAGE_KIND.HOME, "services-teaser")).toEqual({
      up: false,
      down: true,
      duplicate: true,
      remove: true,
    });
    expect(blockActions(document, SITE_PAGE_KIND.HOME, "testimonials").down).toBe(false);
  });
});
