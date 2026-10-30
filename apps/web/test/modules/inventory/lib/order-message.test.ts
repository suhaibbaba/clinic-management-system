import { describe, expect, it } from "vitest";
import type { PurchaseRequest } from "@clinic/shared";
import { orderMessage, whatsappLink } from "@web/modules/inventory/lib/order-message";

const request = {
  number: "PR-2026-0007",
  neededBy: "2026-11-05",
  note: "Deliver to the back door",
  lines: [
    { itemName: "Gloves M", quantity: "10.000", unit: "box", lastPrice: "42.00" },
    { itemName: "Wax", quantity: "2.5", unit: "pack", lastPrice: null },
  ],
} as unknown as PurchaseRequest;

const words = {
  translate: (key: string, values: Record<string, string>) =>
    `${key.split(".").pop() ?? ""}(${Object.values(values).join("|")})`,
  unitLabel: (code: string) => code.toUpperCase(),
};

describe("orderMessage", () => {
  it("lists every line, the needed-by date and the note", () => {
    expect(orderMessage(request, { ...words, price: null })).toBe(
      [
        "title(PR-2026-0007)",
        "• line(Gloves M|10|BOX)",
        "• line(Wax|2.5|PACK)",
        "neededBy(05/11/2026)",
        "Deliver to the back door",
      ].join("\n"),
    );
  });

  it("adds the last price only where one is known and prices are wanted", () => {
    const text = orderMessage(request, { ...words, price: (amount) => `${amount} ₪` });

    expect(text).toContain("• linePriced(Gloves M|10|BOX|42.00 ₪)");
    expect(text).toContain("• line(Wax|2.5|PACK)");
  });
});

describe("whatsappLink", () => {
  it("dials digits only and carries the text encoded", () => {
    expect(whatsappLink("+970 59-123 4567", "a b\nc")).toBe(
      "https://wa.me/970591234567?text=a%20b%0Ac",
    );
  });
});
