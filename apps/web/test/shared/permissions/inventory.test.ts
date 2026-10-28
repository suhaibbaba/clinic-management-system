import { USER_ROLE } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { canFor } from "@test/helpers/fixtures";
import {
  canPaySupplier,
  canReversePricedPurchase,
  canSeeCosts,
} from "@web/shared/permissions/inventory";

describe("who sees what purchasing costs", () => {
  it("shows purchase prices, costs and supplier money to the manager and technician only", () => {
    expect(
      [
        USER_ROLE.ADMIN,
        USER_ROLE.TECHNICIAN,
        USER_ROLE.DOCTOR,
        USER_ROLE.VISITING_DOCTOR,
        USER_ROLE.RECEPTIONIST,
      ].filter((role) => canSeeCosts(canFor(role))),
    ).toEqual([USER_ROLE.ADMIN, USER_ROLE.TECHNICIAN]);
  });

  it("keeps reversing a priced purchase to the manager", () => {
    expect(canReversePricedPurchase(canFor(USER_ROLE.ADMIN))).toBe(true);
    expect(canReversePricedPurchase(canFor(USER_ROLE.TECHNICIAN))).toBe(false);
    expect(canReversePricedPurchase(canFor(USER_ROLE.DOCTOR))).toBe(false);
  });

  it("never lets a doctor record a supplier payment", () => {
    expect(canPaySupplier(canFor(USER_ROLE.DOCTOR))).toBe(false);
  });
});
