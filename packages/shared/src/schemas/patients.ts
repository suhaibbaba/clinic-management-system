import { z } from "zod";
import { GENDERS } from "@shared/enums";
import {
  calendarDateSchema,
  pastDateSchema,
  paginationQuerySchema,
  uuidSchema,
} from "@shared/schemas/common";
import { signedMoneySchema } from "@shared/schemas/money";
import { phoneSchema } from "@shared/schemas/common";

export const patientIdParamSchema = z.object({ patientId: uuidSchema });
export type PatientIdParam = z.infer<typeof patientIdParamSchema>;

export const dateOnlySchema = calendarDateSchema;

export const PROFILE_COMPLETION_FIELDS = ["dateOfBirth", "gender"] as const;
export type ProfileCompletionField = (typeof PROFILE_COMPLETION_FIELDS)[number];

export const missingProfileFields = (patient: {
  readonly dateOfBirth?: string | null | undefined;
  readonly gender?: string | null | undefined;
}): ProfileCompletionField[] => PROFILE_COMPLETION_FIELDS.filter((field) => !patient[field]);

export const patientClinicalViewSchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  fileNumber: z.string(),
  fullName: z.string(),
  firstName: z.string(),
  middleName: z.string().nullable(),
  lastName: z.string(),
  phone: z.string(),
  whatsapp: z.string().nullable(),
  dateOfBirth: dateOnlySchema.nullable(),
  gender: z.enum(GENDERS).nullable(),
  address: z.string().nullable(),
  nationalId: z.string().nullable(),
  emergencyContactName: z.string().nullable(),
  emergencyContactPhone: z.string().nullable(),
  notes: z.string().nullable(),
  assignedDoctorId: z.uuid().nullable(),
  profileIncomplete: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  balance: signedMoneySchema.optional(),
});
export type PatientClinicalView = z.infer<typeof patientClinicalViewSchema>;

export const patientPublicViewSchema = patientClinicalViewSchema
  .pick({
    id: true,
    fileNumber: true,
    fullName: true,
    firstName: true,
    middleName: true,
    lastName: true,
    phone: true,
    whatsapp: true,
    dateOfBirth: true,
    assignedDoctorId: true,
    profileIncomplete: true,
  })
  .extend({ balance: signedMoneySchema.optional() });
export type PatientPublicView = z.infer<typeof patientPublicViewSchema>;

export const patientViewSchema = z.union([patientClinicalViewSchema, patientPublicViewSchema]);
export type PatientView = PatientClinicalView | PatientPublicView;

const nameParts = {
  firstName: z.string().trim().min(1).max(60),
  middleName: z.string().trim().max(80).nullish(),
  lastName: z.string().trim().min(1).max(60),
};

const patientWritableFields = {
  ...nameParts,
  phone: phoneSchema,
  whatsapp: phoneSchema.nullish(),
  dateOfBirth: pastDateSchema.nullish(),
  gender: z.enum(GENDERS).nullish(),
  address: z.string().trim().max(500).nullish(),
  nationalId: z.string().trim().max(64).nullish(),
  emergencyContactName: z.string().trim().max(160).nullish(),
  emergencyContactPhone: phoneSchema.nullish(),
  notes: z.string().trim().max(2000).nullish(),
  assignedDoctorId: uuidSchema.nullish(),
};

export const createPatientSchema = z.object(patientWritableFields);
export type CreatePatientInput = z.infer<typeof createPatientSchema>;

export const updatePatientSchema = z
  .object(patientWritableFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field must be provided");
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

export const inlinePatientSchema = z.object({
  ...nameParts,
  phone: patientWritableFields.phone,
  gender: patientWritableFields.gender,
  dateOfBirth: patientWritableFields.dateOfBirth,
});
export type InlinePatientInput = z.infer<typeof inlinePatientSchema>;

export const patientRefFields = {
  patientId: uuidSchema.optional(),
  newPatient: inlinePatientSchema.optional(),
};

export const hasExactlyOnePatient = (input: {
  readonly patientId?: string | undefined;
  readonly newPatient?: InlinePatientInput | undefined;
}): boolean => (input.patientId === undefined) !== (input.newPatient === undefined);

export const PATIENT_REF_MESSAGE = "Provide either patientId or newPatient";

export const patientPhoneClashSchema = z.object({
  statusCode: z.literal(409),
  message: z.string(),
  error: z.string(),
  existingPatient: patientPublicViewSchema,
});
export type PatientPhoneClash = z.infer<typeof patientPhoneClashSchema>;

export const PATIENT_SORTS = ["balance"] as const;
export type PatientSort = (typeof PATIENT_SORTS)[number];

export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export const listPatientsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(120).optional(),
  gender: z.enum(GENDERS).optional(),
  hasBalance: z.stringbool().optional(),
  visitedSince: calendarDateSchema.optional(),
  sort: z.enum(PATIENT_SORTS).optional(),
  dir: z.enum(SORT_DIRECTIONS).optional(),
});
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;
