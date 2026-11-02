import { describe, expect, it } from "vitest";
import {
  NEW_CLINIC_DEFAULTS,
  newClinicFormSchema,
  newClinicPayload,
  type NewClinicValues,
} from "@web/vendor/lib/new-clinic";

const filled = (patch: Partial<NewClinicValues> = {}): NewClinicValues => ({
  ...NEW_CLINIC_DEFAULTS,
  name: { ar: " عيادة النور ", en: "" },
  slug: "alnoor",
  admin: {
    ...NEW_CLINIC_DEFAULTS.admin,
    firstName: "سامر",
    lastName: "نصار",
    phone: "+970599123456",
  },
  ...patch,
});

const problems = (values: NewClinicValues): string[] => {
  const result = newClinicFormSchema.safeParse(values);

  return result.success
    ? []
    : [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
};

describe("the new clinic form's payload", () => {
  it("trims, drops empty names and leaves out an empty password, email and domain", () => {
    expect(newClinicPayload(filled())).toMatchObject({
      name: { ar: "عيادة النور" },
      domain: null,
      admin: { email: null },
    });
    expect((newClinicPayload(filled()) as { admin: object }).admin).not.toHaveProperty("password");
    expect(problems(filled())).toEqual([]);
  });

  it("carries a password long enough, and puts a short one on the password field", () => {
    const admin = (password: string) => ({ ...filled().admin, password });

    expect(problems(filled({ admin: admin("AdminPassword123") }))).toEqual([]);
    expect(problems(filled({ admin: admin("short") }))).toEqual(["admin.password"]);
  });

  it("strips a domain to its bare host, and lets the schema refuse one that is not a domain", () => {
    expect(newClinicPayload(filled({ domain: "https://www.AbuObaid.PS/" }))).toMatchObject({
      domain: "abuobaid.ps",
    });
    expect(problems(filled({ domain: "not a domain" }))).toEqual(["domain"]);
  });

  it("puts each missing piece on its own field", () => {
    expect(
      problems(
        filled({
          name: { ar: "", en: "" },
          slug: "x",
          specialties: [],
          admin: { ...filled().admin, firstName: "" },
        }),
      ),
    ).toEqual(expect.arrayContaining(["slug", "specialties", "admin.firstName"]));
  });
});
