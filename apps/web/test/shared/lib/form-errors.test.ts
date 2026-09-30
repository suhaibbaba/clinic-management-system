import { createAppointmentSchema } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { FORM_ROOT, nestedErrors, schemaErrors, shownErrors } from "@web/shared/lib/form-errors";

const DOCTOR = "11111111-1111-4111-8111-111111111111";

const booking = (overrides: Record<string, unknown> = {}) => ({
  doctorId: DOCTOR,
  startsAt: "2026-10-01T08:15:00.000Z",
  durationMinutes: 30,
  type: "checkup",
  newPatient: { firstName: "Huda", lastName: "Saleh", phone: "+970599123456" },
  ...overrides,
});

describe("form errors from the shared schema", () => {
  it("finds nothing wrong with a booking the API would take", () => {
    expect(schemaErrors(createAppointmentSchema, booking())).toEqual({});
  });

  it("names each refused field by its path", () => {
    const errors = schemaErrors(
      createAppointmentSchema,
      booking({ newPatient: { firstName: "Huda", lastName: "Saleh", phone: "123" } }),
    );

    expect(Object.keys(errors)).toEqual(["newPatient.phone"]);
    expect(nestedErrors(errors, "newPatient")).toEqual({ phone: errors["newPatient.phone"] });
  });

  it("calls an empty field required, not malformed", () => {
    const errors = schemaErrors(createAppointmentSchema, booking({ doctorId: "" }));

    expect(errors["doctorId"]?.type).toBe("invalid_type");
  });

  it("refuses a date of birth in the future", () => {
    const errors = schemaErrors(
      createAppointmentSchema,
      booking({
        newPatient: {
          firstName: "Huda",
          lastName: "Saleh",
          phone: "+970599123456",
          dateOfBirth: "2999-01-01",
        },
      }),
    );

    expect(Object.keys(errors)).toEqual(["newPatient.dateOfBirth"]);
  });

  it("puts a rule about the whole form on the form's root", () => {
    const { newPatient: _patient, ...withoutPatient } = booking();

    expect(Object.keys(schemaErrors(createAppointmentSchema, withoutPatient))).toContain(FORM_ROOT);
  });

  it("shows a field's error only once the user has left it", () => {
    const errors = schemaErrors(
      createAppointmentSchema,
      booking({ doctorId: "", newPatient: { firstName: "", lastName: "Saleh", phone: "123" } }),
    );

    expect(Object.keys(shownErrors(errors, []))).toEqual([]);
    expect(Object.keys(shownErrors(errors, ["doctorId"]))).toEqual(["doctorId"]);
    expect(Object.keys(shownErrors(errors, ["newPatient.phone"]))).toEqual(["newPatient.phone"]);
  });

  it("refuses a year outside 1900 to 2100 with its own code", () => {
    const errors = schemaErrors(
      createAppointmentSchema,
      booking({
        newPatient: {
          firstName: "Huda",
          lastName: "Saleh",
          phone: "+970599123456",
          dateOfBirth: "0199-01-01",
        },
      }),
    );

    expect(errors["newPatient.dateOfBirth"]?.message).toBe("year_out_of_range");
  });
});
