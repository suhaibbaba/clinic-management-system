import { z } from "zod";
import { BOOKING_NAME_LENGTH } from "@shared/constants/booking";
import {
  APPOINTMENT_STATUSES,
  LEDGER_ENTRY_KINDS,
  PERFORMED_PROCEDURE_STATUSES,
} from "@shared/enums";
import { managedBookingSchema } from "@shared/schemas/booking";
import { phoneSchema, uuidSchema } from "@shared/schemas/common";
import { moneySchema, signedMoneySchema } from "@shared/schemas/money";
import { personNameSchema } from "@shared/schemas/person-name";
import { prescriptionItemSchema } from "@shared/schemas/prescriptions";

export const PORTAL_CODE_LENGTH = 6;

export const requestPortalCodeSchema = z.object({ phone: phoneSchema });
export type RequestPortalCodeInput = z.infer<typeof requestPortalCodeSchema>;

export const portalCodeReceiptSchema = z.object({
  sent: z.literal(true),
  expiresInSeconds: z.number().int().positive(),
  resendAfterSeconds: z.number().int().nonnegative(),
});
export type PortalCodeReceipt = z.infer<typeof portalCodeReceiptSchema>;

export const startPortalSessionSchema = z.object({
  phone: phoneSchema,
  code: z.string().trim().length(PORTAL_CODE_LENGTH).regex(/^\d+$/),
});
export type StartPortalSessionInput = z.infer<typeof startPortalSessionSchema>;

export const portalPatientSummarySchema = z.object({
  id: uuidSchema,
  fullName: z.string(),
  firstName: z.string(),
  fileNumber: z.string(),
});
export type PortalPatientSummary = z.infer<typeof portalPatientSummarySchema>;

export const portalAccountSchema = z.object({
  clinicSlug: z.string(),
  currency: z.string(),
  timeZone: z.string(),
  expiresAt: z.iso.datetime(),
  patients: z.array(portalPatientSummarySchema),
});
export type PortalAccount = z.infer<typeof portalAccountSchema>;

export const portalAppointmentSchema = z.object({
  id: uuidSchema,
  startsAt: z.iso.datetime(),
  durationMinutes: z.number().int().positive(),
  status: z.enum(APPOINTMENT_STATUSES),
  doctor: personNameSchema,
});
export type PortalAppointment = z.infer<typeof portalAppointmentSchema>;

export const portalTreatmentSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  status: z.enum(PERFORMED_PROCEDURE_STATUSES),
  performedAt: z.iso.datetime(),
  doctor: personNameSchema,
  teeth: z.array(z.number().int()),
  price: moneySchema,
  discount: moneySchema,
});
export type PortalTreatment = z.infer<typeof portalTreatmentSchema>;

export const portalVisitSchema = z.object({
  id: uuidSchema,
  visitDate: z.iso.datetime(),
  doctor: personNameSchema,
  complaint: z.string().nullable(),
  diagnosis: z.string().nullable(),
});
export type PortalVisit = z.infer<typeof portalVisitSchema>;

export const portalPrescriptionSchema = z.object({
  id: uuidSchema,
  createdAt: z.iso.datetime(),
  doctor: personNameSchema,
  items: z.array(prescriptionItemSchema),
  notes: z.string().nullable(),
});
export type PortalPrescription = z.infer<typeof portalPrescriptionSchema>;

export const portalStatementEntrySchema = z.object({
  id: uuidSchema,
  kind: z.enum(LEDGER_ENTRY_KINDS),
  occurredAt: z.iso.datetime(),
  description: z.string(),
  amount: signedMoneySchema,
  runningBalance: signedMoneySchema,
  receiptNumber: z.number().int().positive().nullable(),
  isReversal: z.boolean(),
  isReversed: z.boolean(),
});
export type PortalStatementEntry = z.infer<typeof portalStatementEntrySchema>;

export const portalAttachmentSchema = z.object({
  id: uuidSchema,
  filename: z.string(),
  mime: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  tooth: z.number().int().nullable(),
  createdAt: z.iso.datetime(),
  previewUrl: z.url().nullable(),
});
export type PortalAttachment = z.infer<typeof portalAttachmentSchema>;

export const portalRecordSchema = z.object({
  patient: z.object({
    id: uuidSchema,
    fullName: z.string(),
    fileNumber: z.string(),
    phone: z.string(),
    dateOfBirth: z.iso.date().nullable(),
    allergies: z.array(z.string()),
    chronicConditions: z.array(z.string()),
  }),
  balance: z.object({
    charged: moneySchema,
    paid: moneySchema,
    balance: signedMoneySchema,
  }),
  appointments: z.array(portalAppointmentSchema),
  treatments: z.array(portalTreatmentSchema),
  visits: z.array(portalVisitSchema),
  prescriptions: z.array(portalPrescriptionSchema),
  statement: z.array(portalStatementEntrySchema),
  attachments: z.array(portalAttachmentSchema),
});
export type PortalRecord = z.infer<typeof portalRecordSchema>;

export const portalPatientParamSchema = z.object({ patientId: uuidSchema });
export type PortalPatientParam = z.infer<typeof portalPatientParamSchema>;

export const portalAttachmentParamSchema = z.object({
  patientId: uuidSchema,
  attachmentId: uuidSchema,
});
export type PortalAttachmentParam = z.infer<typeof portalAttachmentParamSchema>;

export const portalFileLinkSchema = z.object({
  url: z.url(),
  expiresAt: z.iso.datetime(),
});
export type PortalFileLink = z.infer<typeof portalFileLinkSchema>;

const portalBookingNameSchema = z
  .string()
  .trim()
  .min(BOOKING_NAME_LENGTH.min)
  .max(BOOKING_NAME_LENGTH.max);

export const portalBookingSchema = z
  .object({
    doctorId: uuidSchema,
    startsAt: z.iso.datetime(),
    reason: z.string().trim().max(300).nullish(),
    patientId: uuidSchema.optional(),
    newPatient: z
      .object({ firstName: portalBookingNameSchema, lastName: portalBookingNameSchema })
      .optional(),
  })
  .refine((input) => (input.patientId === undefined) !== (input.newPatient === undefined), {
    message: "Choose one patient on the account or name a new one",
    path: ["patientId"],
  });
export type PortalBookingInput = z.infer<typeof portalBookingSchema>;

export const portalBookingReceiptSchema = z.object({
  token: z.string(),
  booking: managedBookingSchema.nullable(),
});
export type PortalBookingReceipt = z.infer<typeof portalBookingReceiptSchema>;
