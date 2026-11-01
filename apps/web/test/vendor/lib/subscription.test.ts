import {
  CLINIC_MODULE,
  SUBSCRIPTION_STATUS,
  type Plan,
  type VendorClinicDetail,
} from "@clinic/shared";
import { describe, expect, it } from "vitest";
import {
  initialSubscription,
  isReadOnly,
  lacksDependency,
  planInput,
  resultingModules,
} from "@web/vendor/lib/subscription";
import { VendorApiError, vendorErrorKey } from "@web/vendor/lib/vendor-api-error";

const plan = (overrides: Partial<Plan> = {}): Plan => ({
  id: "22222222-2222-4222-8222-222222222222",
  code: "basic",
  name: "Basic",
  modules: [CLINIC_MODULE.LABS],
  maxUsers: null,
  maxDoctors: null,
  isActive: true,
  clinicCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const clinic = (overrides: Partial<VendorClinicDetail> = {}): VendorClinicDetail => ({
  id: "33333333-3333-4333-8333-333333333333",
  slug: "clinic",
  name: { en: "Clinic" },
  domain: null,
  modules: [],
  specialties: [],
  users: 1,
  doctors: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  subscription: null,
  events: [],
  ...overrides,
});

describe("a subscription's modules", () => {
  it("joins the plan and the add-ons in the product's order, once each", () => {
    expect(
      resultingModules(
        [CLINIC_MODULE.LABS, CLINIC_MODULE.APPOINTMENTS],
        [CLINIC_MODULE.WEBSITE, CLINIC_MODULE.LABS],
      ),
    ).toEqual([CLINIC_MODULE.APPOINTMENTS, CLINIC_MODULE.LABS, CLINIC_MODULE.WEBSITE]);
  });

  it("flags booking without appointments", () => {
    expect(lacksDependency([CLINIC_MODULE.BOOKING])).toBe(true);
    expect(lacksDependency([CLINIC_MODULE.BOOKING, CLINIC_MODULE.APPOINTMENTS])).toBe(false);
  });

  it("calls suspended and cancelled clinics read-only, and nothing else", () => {
    expect(isReadOnly(SUBSCRIPTION_STATUS.SUSPENDED)).toBe(true);
    expect(isReadOnly(SUBSCRIPTION_STATUS.CANCELLED)).toBe(true);
    expect(isReadOnly(SUBSCRIPTION_STATUS.GRACE)).toBe(false);
    expect(isReadOnly(null)).toBe(false);
  });
});

describe("the subscription form's starting values", () => {
  it("offers a 30-day trial on the first offered plan to a clinic without one", () => {
    expect(
      initialSubscription(clinic(), [plan({ isActive: false, id: "x" }), plan()], "2026-11-01"),
    ).toEqual({
      planId: plan().id,
      addOnModules: [],
      status: SUBSCRIPTION_STATUS.TRIAL,
      startsOn: "2026-11-01",
      endsOn: "2026-12-01",
      graceDays: 14,
      notes: null,
    });
  });

  it("starts from the clinic's own subscription when it has one", () => {
    const subscription = {
      planId: plan().id,
      planName: "Basic",
      addOnModules: [CLINIC_MODULE.WEBSITE],
      status: SUBSCRIPTION_STATUS.ACTIVE,
      startsOn: "2026-01-01",
      endsOn: null,
      graceDays: 7,
      notes: "paid yearly",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    expect(initialSubscription(clinic({ subscription }), [plan()])).toMatchObject({
      addOnModules: [CLINIC_MODULE.WEBSITE],
      status: SUBSCRIPTION_STATUS.ACTIVE,
      endsOn: null,
      graceDays: 7,
      notes: "paid yearly",
    });
  });

  it("opens a new plan empty and an existing one with its values", () => {
    expect(planInput(null)).toEqual({
      code: "",
      name: "",
      modules: [],
      maxUsers: null,
      maxDoctors: null,
      isActive: true,
    });
    expect(planInput(plan({ maxUsers: 5 }))).toMatchObject({ code: "basic", maxUsers: 5 });
  });
});

describe("the vendor console's error messages", () => {
  it.each([
    [new VendorApiError(400, "vendor_missing_modules"), "vendor.errors.missingModules"],
    [new VendorApiError(429, "auth_locked"), "vendor.signIn.locked"],
    [new VendorApiError(401, undefined), "vendor.signIn.failed"],
    [new VendorApiError(409, undefined), "vendor.errors.duplicateCode"],
    [new VendorApiError(404, undefined), "vendor.errors.notFound"],
    [new Error("offline"), "vendor.errors.unknown"],
  ])("explains %s", (error, key) => {
    expect(vendorErrorKey(error)).toBe(key);
  });
});
