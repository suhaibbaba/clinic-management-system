import { describe, expect, it } from "vitest";
import { parseVendorRoute, vendorPath } from "@web/vendor/lib/route";

const ID = "11111111-1111-4111-8111-111111111111";

describe("the vendor console's addresses", () => {
  it.each([
    ["/vendor", { kind: "clinics" }],
    ["/vendor/", { kind: "clinics" }],
    ["/vendor/login", { kind: "login" }],
    ["/vendor/plans", { kind: "plans" }],
    [`/vendor/clinics/${ID}`, { kind: "clinic", id: ID }],
    ["/vendor/clinics/not-an-id", { kind: "not-found" }],
    ["/vendor/clinics", { kind: "not-found" }],
    [`/vendor/clinics/${ID}/extra`, { kind: "not-found" }],
  ])("reads %s", (path, route) => {
    expect(parseVendorRoute(path)).toEqual(route);
  });

  it("writes every address it reads back to the same route", () => {
    for (const route of [
      { kind: "login" },
      { kind: "clinics" },
      { kind: "plans" },
      { kind: "clinic", id: ID },
    ] as const) {
      expect(parseVendorRoute(vendorPath(route))).toEqual(route);
    }
  });
});
