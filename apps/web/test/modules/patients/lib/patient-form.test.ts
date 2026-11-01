import { describe, expect, it } from "vitest";
import { patientFormSchema } from "@web/modules/patients/lib/patient-form";

const patient = (nationalId: string | null) => ({
  firstName: "Ayşe",
  lastName: "Yılmaz",
  phone: "+905321234567",
  nationalId,
});

const nationalIdIssue = (country: string, nationalId: string | null) =>
  patientFormSchema(country)
    .safeParse(patient(nationalId))
    .error?.issues.find((issue) => issue.path.join(".") === "nationalId");

describe("the patient form", () => {
  it("refuses a national ID that fails the clinic country's check", () => {
    expect(nationalIdIssue("TR", "12345678901")?.message).toBe("nationalIdInvalid");
    expect(nationalIdIssue("tr", "10000000140")?.message).toBe("nationalIdInvalid");
  });

  it("takes a national ID that passes the clinic country's check", () => {
    expect(nationalIdIssue("TR", "10000000146")).toBeUndefined();
    expect(nationalIdIssue("TR", " 10000000146 ")).toBeUndefined();
  });

  it("leaves the national ID optional", () => {
    expect(nationalIdIssue("TR", null)).toBeUndefined();
  });

  it("does not check a national ID where the country has no check", () => {
    expect(nationalIdIssue("SY", "12345")).toBeUndefined();
    expect(nationalIdIssue("", "12345")).toBeUndefined();
  });
});
