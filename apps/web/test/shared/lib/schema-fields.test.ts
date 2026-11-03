import { createPatientSchema } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { fieldNeed, fieldNeeds } from "@web/shared/lib/schema-fields";

describe("a field's need, read from its schema", () => {
  const need = fieldNeeds(createPatientSchema);

  it("calls a field the schema insists on required", () => {
    expect(need("firstName")).toEqual({ required: true });
    expect(need("lastName")).toEqual({ required: true });
  });

  it("calls a field the schema lets go missing optional", () => {
    expect(need("phone")).toEqual({ optional: true });
    expect(need("middleName")).toEqual({ optional: true });
    expect(need("dateOfBirth")).toEqual({ optional: true });
  });
});

describe("a nested field's need", () => {
  it("reads the field inside an object the form sends", async () => {
    const { createVisitSchema } = await import("@clinic/shared");

    expect(fieldNeed(createVisitSchema, "doctorId")).toEqual({ required: true });
    expect(fieldNeed(createVisitSchema, "newPatient.firstName")).toEqual({ required: true });
    expect(fieldNeed(createVisitSchema, "newPatient.phone")).toEqual({ optional: true });
    expect(fieldNeed(createVisitSchema, "fee.price")).toEqual({ optional: true });
  });
});
