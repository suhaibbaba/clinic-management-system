import { CLINIC_MODULE, SUBSCRIPTION_STATUS, type Subscription } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import {
  addMonths,
  extendedByAMonth,
  initials,
  slugFrom,
  suspended,
} from "@web/vendor/lib/clinic-actions";
import { newClinicProblems } from "@web/vendor/lib/new-clinic";

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

describe("extending a subscription by a month", () => {
  it.each([
    ["2026-01-31", "2026-02-28"],
    ["2026-12-15", "2027-01-15"],
    ["2028-01-31", "2028-02-29"],
  ])("moves %s to %s", (from, to) => {
    expect(addMonths(from, 1)).toBe(to);
  });

  it("adds a month to a future end date and keeps the rest", () => {
    expect(extendedByAMonth(subscription(), "2026-11-02")).toMatchObject({
      endsOn: "2027-01-15",
      status: SUBSCRIPTION_STATUS.ACTIVE,
      addOnModules: [CLINIC_MODULE.WEBSITE],
    });
  });

  it("counts from today for an ended one, and reactivates it", () => {
    expect(
      extendedByAMonth(
        subscription({ status: SUBSCRIPTION_STATUS.SUSPENDED, endsOn: "2026-09-01" }),
        "2026-11-02",
      ),
    ).toMatchObject({ endsOn: "2026-12-02", status: SUBSCRIPTION_STATUS.ACTIVE });
  });

  it("keeps a trial a trial", () => {
    expect(
      extendedByAMonth(subscription({ status: SUBSCRIPTION_STATUS.TRIAL }), "2026-11-02").status,
    ).toBe(SUBSCRIPTION_STATUS.TRIAL);
  });

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

describe("the new clinic's problems", () => {
  const valid = {
    name: { ar: "عيادة النور" },
    slug: "alnoor",
    country: "PS",
    domain: null,
    specialties: ["dental" as const],
    planId: "22222222-2222-4222-8222-222222222222",
    trialDays: 30,
    admin: { firstName: "سامر", lastName: "نصار", phone: "+970599123456", email: null },
  };

  it("finds none in a complete clinic", () => {
    expect(newClinicProblems(valid, false)).toEqual([]);
  });

  it("names each missing piece once, in the form's order", () => {
    expect(
      newClinicProblems(
        {
          ...valid,
          name: {},
          slug: "x",
          specialties: [],
          admin: { ...valid.admin, firstName: "" },
        },
        true,
      ),
    ).toEqual(["domain", "name", "slug", "specialty", "admin"]);
  });
});
