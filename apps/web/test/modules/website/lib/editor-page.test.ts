import {
  defaultSiteDocument,
  SITE_PAGE_KIND,
  SITE_PREVIEW_MESSAGE,
  siteDocumentPage,
} from "@clinic/shared";
import { describe, expect, it } from "vitest";
import {
  applyBlockMessage,
  blockErrorScopes,
  blockPath,
  editorAddress,
  editorPageKind,
  editParam,
  findBlock,
  firstInvalidBlock,
  inErrorScope,
  isBlockError,
  previewPath,
  readEditParam,
} from "@web/modules/website/lib/editor-page";

describe("editor page", () => {
  it("carries a retired content-tab address into the editor, keeping only its own params", () => {
    expect(
      editorAddress(
        new URLSearchParams("view=website&tab=content&page=about&edit=about.hero&lang=en"),
      ),
    ).toBe("/website/edit?page=about&edit=about.hero&lang=en");
    expect(editorAddress(new URLSearchParams("view=website&tab=content"))).toBeNull();
  });

  it("reads the page kind from the address, home when unknown", () => {
    expect(editorPageKind("about")).toBe(SITE_PAGE_KIND.ABOUT);
    expect(editorPageKind("account")).toBe(SITE_PAGE_KIND.HOME);
    expect(editorPageKind(null)).toBe(SITE_PAGE_KIND.HOME);
  });

  it("finds a block and its path in the document", () => {
    const document = defaultSiteDocument();
    const contact = document.pages.findIndex((page) => page.kind === SITE_PAGE_KIND.CONTACT);

    expect(blockPath(document, SITE_PAGE_KIND.CONTACT, "contact-main")).toBe(
      `pages.${contact}.blocks.1`,
    );
    expect(blockPath(document, SITE_PAGE_KIND.CONTACT, "missing")).toBeNull();
    expect(findBlock(document, SITE_PAGE_KIND.HOME, "cases")?.type).toBe("cases");
    expect(findBlock(document, SITE_PAGE_KIND.HOME, null)).toBeUndefined();
  });

  it("points at the first block with an error, or nothing for site settings", () => {
    const document = defaultSiteDocument();

    expect(
      firstInvalidBlock(document, ["brand.social.instagram", "pages.0.blocks.3.items.0.text"]),
    ).toEqual({
      kind: SITE_PAGE_KIND.HOME,
      id: "cases",
    });
    expect(firstInvalidBlock(document, ["collections.services.items.0.title"])).toBeNull();
  });

  it("builds the preview address with the language only when it is not the primary one", () => {
    expect(previewPath(SITE_PAGE_KIND.HOME, "ar", "ar")).toBe("");
    expect(previewPath(SITE_PAGE_KIND.BOOKING, "en", "ar")).toBe("/appointment?lang=en");
  });

  it("writes and reads the block being edited in the address", () => {
    const target = { kind: SITE_PAGE_KIND.CONTACT, id: "contact-main" };

    expect(editParam(target)).toBe("contact.contact-main");
    expect(readEditParam(editParam(target))).toEqual(target);
    expect(readEditParam(null)).toBeNull();
    expect(readEditParam("contact")).toBeNull();
    expect(readEditParam("contact.")).toBeNull();
    expect(readEditParam("account.hero")).toBeNull();
  });

  it("scopes a block's errors to its own fields and the collection it lists", () => {
    const document = defaultSiteDocument();
    const cases = findBlock(document, SITE_PAGE_KIND.HOME, "cases");
    const services = document.pages
      .flatMap((page) => page.blocks)
      .find((block) => block.type === "servicesGrid");

    expect(cases && blockErrorScopes(cases, "pages.0.blocks.3")).toEqual(["pages.0.blocks.3"]);
    expect(services && blockErrorScopes(services, "pages.1.blocks.1")).toEqual([
      "pages.1.blocks.1",
      "collections.services",
    ]);
    expect(inErrorScope("pages.0.blocks.3.items.0.text", ["pages.0.blocks.3"])).toBe(true);
    expect(inErrorScope("pages.0.blocks.3", ["pages.0.blocks.3"])).toBe(true);
    expect(inErrorScope("pages.0.blocks.30.title", ["pages.0.blocks.3"])).toBe(false);
    expect(isBlockError("pages.0.blocks.3.title")).toBe(true);
    expect(isBlockError("brand.social.instagram")).toBe(false);
  });

  it("applies move and remove messages and ignores the others", () => {
    const document = defaultSiteDocument();
    const moved = applyBlockMessage(document, {
      type: SITE_PREVIEW_MESSAGE.MOVE,
      kind: SITE_PAGE_KIND.HOME,
      id: "cases",
      delta: -1,
    });
    const ids = siteDocumentPage(moved, SITE_PAGE_KIND.HOME)?.blocks.map((block) => block.id);

    expect(ids?.indexOf("cases")).toBe(2);
    expect(
      applyBlockMessage(document, {
        type: SITE_PREVIEW_MESSAGE.EDIT,
        kind: SITE_PAGE_KIND.HOME,
        id: "cases",
      }),
    ).toBe(document);
    expect(
      applyBlockMessage(document, {
        type: SITE_PREVIEW_MESSAGE.REMOVE,
        kind: SITE_PAGE_KIND.HOME,
        id: "hero",
      }),
    ).toBe(document);
  });
});
