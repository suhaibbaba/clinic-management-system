import { ITEM_CATEGORY, ITEM_UNIT, type ShoppingListLine } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import {
  bySupplier,
  purchaseLink,
  shoppingListLink,
} from "@web/modules/inventory/lib/shopping-list";

const line = (
  itemId: string,
  supplierId: string | null,
  supplierName: string | null = null,
): ShoppingListLine => ({
  itemId,
  name: itemId,
  category: ITEM_CATEGORY.CONSUMABLE,
  unit: ITEM_UNIT.BOX,
  quantity: "1",
  minQuantity: "5",
  suggested: "9",
  supplierId,
  supplierName,
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

  it("groups the chosen lines by supplier, by name, with the lines without one last", () => {
    const groups = bySupplier([
      line("a", null),
      line("b", "s2", "Nour"),
      line("c", "s1", "Amal"),
      line("d", "s2", "Nour"),
    ]);

    expect(
      groups.map((group) => [group.supplierId, group.lines.map((entry) => entry.itemId)]),
    ).toEqual([
      ["s1", ["c"]],
      ["s2", ["b", "d"]],
      [null, ["a"]],
    ]);
  });

  it("sends the purchase back to the list with what is still to buy", () => {
    const back = shoppingListLink(["c", "d"]);
    const params = new URL(purchaseLink([line("a", "s1")], back), "http://x").searchParams;

    expect(back).toBe("/inventory/shopping-list?pick=c&pick=d");
    expect(params.get("return")).toBe(back);
    expect(shoppingListLink([])).toBe("/inventory/shopping-list");
  });
});
