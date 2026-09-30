import { VALIDATION_CODE } from "@clinic/shared";
import type { FieldError } from "react-hook-form";

const NOTHING_GIVEN = /to have >=1 (characters|items)$/;

const CODED: Readonly<Record<string, string>> = {
  [VALIDATION_CODE.YEAR_OUT_OF_RANGE]: "errors.validation.yearOutOfRange",
  [VALIDATION_CODE.DATE_IN_FUTURE]: "errors.validation.dateInFuture",
  [VALIDATION_CODE.DATE_IN_PAST]: "errors.validation.dateInPast",
};

export function validationMessageKey(error: FieldError | undefined): string | undefined {
  if (!error) {
    return undefined;
  }

  const coded = error.message === undefined ? undefined : CODED[error.message];

  if (coded) {
    return coded;
  }

  switch (error.type) {
    case "too_small":
      return NOTHING_GIVEN.test(error.message ?? "")
        ? "errors.validation.required"
        : "errors.validation.tooSmall";
    case "too_big":
      return "errors.validation.tooBig";
    case "invalid_type":
      return "errors.validation.required";
    case "invalid_format":
    case "invalid_string":
      return "errors.validation.invalidFormat";
    case "invalid_value":
    case "invalid_enum_value":
      return "errors.validation.invalid";
    default:
      return "errors.validation.invalid";
  }
}
