import { describe, expect, it } from "vitest";
import type { PurchaseRequest } from "@clinic/shared";
import { orderMessage } from "@web/modules/inventory/lib/order-message";

const request = {
  number: "PR-2026-0007",
  supplierName: "Dental Supply",
  neededBy: "2026-11-05",
} as unknown as PurchaseRequest;

const sender = { name: "Sara Haddad", clinic: "Smile Clinic" };

const translate = (key: string, values: Record<string, string> = {}) =>
  `${key.split(".").pop() ?? ""}(${Object.values(values).join("|")})`;

describe("orderMessage", () => {
  it("greets the supplier, names the sender, the clinic, the request and its date on one line", () => {
    expect(orderMessage(request, sender, translate)).toBe(
      "greetingNamed(Dental Supply) from(Sara Haddad|Smile Clinic) body(PR-2026-0007) neededBy(05/11/2026) closing()",
    );
  });

  it("falls back to the clinic alone and skips what is not known", () => {
    expect(
      orderMessage(
        { ...request, supplierName: null, neededBy: null },
        { ...sender, name: "" },
        translate,
      ),
    ).toBe("greeting() fromClinic(Smile Clinic) body(PR-2026-0007) closing()");
  });
});
