import { CLINIC_MODULE, SUBSCRIPTION_STATUS, type Subscription } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { initials, slugFrom, suspended } from "@web/vendor/lib/clinic-actions";

const subscription = (overrides: Partial<Subscription> = {}): Subscription => ({
  planId: "22222222-2222-4222-8222-222222222222",
  planName: "Pro",
  addOnModules: [CLINIC_MODULE.WEBSITE],
  status: SUBSCRIPTION_STATUS.ACTIVE,
  startsOn: "2026-01-01",
  endsOn: "2026-12-15",
  graceDays: 14,
  notes: null,
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("suspending a subscription", () => {
  it("suspends without touching the dates", () => {
    expect(suspended(subscription())).toMatchObject({
      status: SUBSCRIPTION_STATUS.SUSPENDED,
      endsOn: "2026-12-15",
    });
  });
});

describe("a clinic's mark and short link", () => {
  it("takes two letters from the name in the reader's language", () => {
    expect(initials({ ar: "عيادة أبو عبيد لطب الأسنان", en: "Abu Obeid Dental" }, "ar")).toBe("أع");
    expect(initials({ en: "Al Noor Dental" }, "en")).toBe("ND");
  });

  it("turns an English name into a short link", () => {
    expect(slugFrom("Al Noor  Dental!")).toBe("al-noor-dental");
    expect(slugFrom("  Dr. Kossai Jarrar ")).toBe("dr-kossai-jarrar");
  });
});
