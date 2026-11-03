import { describe, expect, it } from "vitest";
import {
  joinPath,
  missingTranslation,
  moveItem,
  removeAt,
  replaceAt,
  valueAt,
  withValueAt,
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

describe("site draft paths", () => {
  it("joins a scope and a field, skipping empty parts", () => {
    expect(joinPath("", "brand.tagline")).toBe("brand.tagline");
    expect(joinPath("pages.0.blocks.1", "")).toBe("pages.0.blocks.1");
    expect(joinPath("pages.0.blocks.1", "title")).toBe("pages.0.blocks.1.title");
  });

  it("reads and writes by path, the empty path being the whole value", () => {
    const source = { pages: [{ blocks: [{ title: { en: "A" } }] }] };

    expect(valueAt(source, "")).toBe(source);
    expect(valueAt(source, "pages.0.blocks.0.title.en")).toBe("A");
    expect(withValueAt(source, "pages.0.blocks.0.title", { en: "B" })).toEqual({
      pages: [{ blocks: [{ title: { en: "B" } }] }],
    });
    expect(source.pages[0]?.blocks[0]?.title.en).toBe("A");
  });
});

describe("missing translations", () => {
  it("marks an empty language only when another one is written", () => {
    expect(missingTranslation({ ar: "مرحبا" }, "en")).toBe(true);
    expect(missingTranslation({ ar: "مرحبا", en: "Hi" }, "en")).toBe(false);
    expect(missingTranslation({}, "en")).toBe(false);
    expect(missingTranslation({ ar: "  " }, "en")).toBe(false);
  });
});
