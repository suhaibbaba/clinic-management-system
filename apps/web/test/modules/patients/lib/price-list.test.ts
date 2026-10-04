import { LOOKUP_LIST } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import {
  procedureOutcomes,
  searchPriceList,
  wholePrice,
} from "@web/modules/patients/lib/price-list";
import { makeCatalogItem, makeLookupBundle } from "@test/helpers/fixtures";

describe("the price list", () => {
  const items = [
    makeCatalogItem({ id: "a", code: "RCT", name: "Root canal treatment" }),
    makeCatalogItem({ id: "b", code: "FILL-C", name: "Composite filling" }),
  ];

  it("finds a procedure by its name or its code, ignoring case", () => {
    expect(searchPriceList(items, "canal").map((item) => item.id)).toEqual(["a"]);
    expect(searchPriceList(items, "fill-c").map((item) => item.id)).toEqual(["b"]);
    expect(searchPriceList(items, "  ")).toEqual(items);
    expect(searchPriceList(items, "implant")).toEqual([]);
  });

  it("offers as an outcome only the states a procedure can leave on a tooth", () => {
    const codes = procedureOutcomes(makeLookupBundle()[LOOKUP_LIST.TOOTH_STATE] ?? []).map(
      (state) => state.code,
    );

    expect(codes).toContain("filling");
    expect(codes).not.toContain("healthy");
    expect(codes).not.toContain("planned");
    expect(codes).not.toContain("in_progress");
  });

  it("shows a stored price as a whole number without touching its digits", () => {
    expect(wholePrice("150.00")).toBe("150");
    expect(wholePrice("1200.00")).toBe("1200");
    expect(wholePrice("80")).toBe("80");
  });
});
