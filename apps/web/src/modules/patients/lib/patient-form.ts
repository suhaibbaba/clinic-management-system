import { createPatientSchema, hasNationalIdCheck, isValidNationalId } from "@clinic/shared";

export function patientFormSchema(country: string): typeof createPatientSchema {
  if (!hasNationalIdCheck(country)) {
    return createPatientSchema;
  }

  return createPatientSchema.superRefine((values, context) => {
    const nationalId = values.nationalId?.trim() ?? "";

    if (nationalId !== "" && !isValidNationalId(nationalId, country)) {
      context.addIssue({ code: "custom", path: ["nationalId"], message: "nationalIdInvalid" });
    }
  });
}
