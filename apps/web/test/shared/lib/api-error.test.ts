import { APPOINTMENT_ERROR, AUTH_ERROR } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import {
  ApiError,
  errorMessageKey,
  errorToast,
  invalidFieldLabels,
} from "@web/shared/lib/api-error";

describe("errors read by code", () => {
  it("tells a locked sign-in apart from a plain rate limit", () => {
    expect(errorMessageKey(new ApiError(429, { message: AUTH_ERROR.LOCKED }))).toBe(
      "errors.auth.locked",
    );
    expect(
      errorMessageKey(new ApiError(429, { message: "ThrottlerException: Too Many Requests" })),
    ).toBe("errors.tooMany");
  });

  it("reads a refused sign-in code as its own message", () => {
    expect(errorMessageKey(new ApiError(401, { message: AUTH_ERROR.CODE_INVALID }))).toBe(
      "errors.auth.codeInvalid",
    );
  });
});

describe("what a refused write says", () => {
  const invalid = (paths: (string | number)[][]) =>
    new ApiError(400, {
      statusCode: 400,
      message: "Validation failed",
      errors: paths.map((path) => ({ path, message: "Invalid" })),
    });

  it("names the fields the API refused, once each, in the form's own words", () => {
    expect(
      invalidFieldLabels(invalid([["newPatient", "phone"], ["newPatient", "phone"], ["startsAt"]])),
    ).toEqual(["patients.phone", "appointments.date"]);
  });

  it("reads the field nearest the value, not the object around it", () => {
    expect(invalidFieldLabels(invalid([["chartMarks", 0, "location", "tooth"]]))).toEqual([
      "visits.teeth",
    ]);
  });

  it("falls back to the plain message when no field it knows is named", () => {
    expect(errorToast(invalid([["somethingElse"]]))).toEqual(["errors.badRequest"]);
    expect(errorToast(new ApiError(409, { message: APPOINTMENT_ERROR.SLOT_TAKEN }))).toEqual([
      "errors.appointment.slotTaken",
    ]);
  });

  it("lists the refused fields in the toast", () => {
    const [key, values] = errorToast(invalid([["phone"]]));

    expect(key).toBe("errors.invalidFields");
    expect(values?.["fields"]).toBeTruthy();
  });
});
