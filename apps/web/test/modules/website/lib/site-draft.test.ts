import { describe, expect, it } from "vitest";
import { SITE_SECTION } from "@clinic/shared";
import {
  moveItem,
  removeAt,
  replaceAt,
  sectionOrder,
  setSectionVisible,
} from "@web/modules/website/lib/site-draft";

describe("site draft lists", () => {
  it("moves an item one step and refuses to leave the list", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });

  it("replaces and removes by position without touching the original", () => {
    const list = ["a", "b", "c"] as const;

    expect(replaceAt(list, 1, "x")).toEqual(["a", "x", "c"]);
    expect(removeAt(list, 0)).toEqual(["b", "c"]);
    expect(list).toEqual(["a", "b", "c"]);
  });
});

describe("site sections", () => {
  it("lists the shown sections in their order, then the hidden ones", () => {
    expect(sectionOrder([SITE_SECTION.CONTACT, SITE_SECTION.SERVICES])).toEqual([
      SITE_SECTION.CONTACT,
      SITE_SECTION.SERVICES,
      SITE_SECTION.DOCTORS,
      SITE_SECTION.ABOUT,
      SITE_SECTION.BOOKING,
      SITE_SECTION.PORTAL,
    ]);
  });

  it("hides a section and brings it back at the end, once", () => {
    const hidden = setSectionVisible(
      [SITE_SECTION.SERVICES, SITE_SECTION.DOCTORS],
      SITE_SECTION.SERVICES,
      false,
    );

    expect(hidden).toEqual([SITE_SECTION.DOCTORS]);
    expect(setSectionVisible(hidden, SITE_SECTION.SERVICES, true)).toEqual([
      SITE_SECTION.DOCTORS,
      SITE_SECTION.SERVICES,
    ]);
    expect(setSectionVisible(hidden, SITE_SECTION.DOCTORS, true)).toEqual([SITE_SECTION.DOCTORS]);
  });
});
