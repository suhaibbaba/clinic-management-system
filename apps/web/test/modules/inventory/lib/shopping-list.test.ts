import { ITEM_CATEGORY, ITEM_UNIT, type ShoppingListLine } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { purchaseLink } from "@web/modules/inventory/lib/shopping-list";

const line = (itemId: string, supplierId: string | null): ShoppingListLine => ({
  itemId,
  name: itemId,
  category: ITEM_CATEGORY.CONSUMABLE,
  unit: ITEM_UNIT.BOX,
  quantity: "1",
  minQuantity: "5",
  suggested: "9",
  supplierId,
  supplierName: null,
});

describe("the shopping list", () => {
  it("links the chosen lines to a purchase with their suggested quantities", () => {
    const params = new URL(purchaseLink([line("a", "s1"), line("b", "s1")]), "http://x")
      .searchParams;

    expect(params.getAll("item")).toEqual(["a:9", "b:9"]);
    expect(params.get("supplier")).toBe("s1");
  });

  it("leaves the supplier open when the lines come from different suppliers or none", () => {
    const mixed = new URL(purchaseLink([line("a", "s1"), line("b", "s2")]), "http://x");
    const none = new URL(purchaseLink([line("a", null)]), "http://x");

    expect(mixed.searchParams.has("supplier")).toBe(false);
    expect(none.searchParams.has("supplier")).toBe(false);
  });
});
