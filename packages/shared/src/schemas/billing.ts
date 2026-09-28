import { z } from "zod";
import { personNameSchema } from "@shared/schemas/person-name";
import { LEDGER_ENTRY_KINDS } from "@shared/enums";
import { paginationQuerySchema, uuidSchema } from "@shared/schemas/common";
import { signedMoneySchema, wholeMoneySchema } from "@shared/schemas/money";
import { lookupCodeSchema } from "@shared/schemas/lookups";

export const chargeSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  patientId: uuidSchema,
  performedProcedureId: uuidSchema.nullable(),
  amount: signedMoneySchema,
  discount: signedMoneySchema,
  discountReason: z.string().nullable(),
  note: z.string().nullable(),
  reversesId: uuidSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type Charge = z.infer<typeof chargeSchema>;

export const paymentSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  patientId: uuidSchema,
  amount: signedMoneySchema,
  method: lookupCodeSchema,
  note: z.string().nullable(),
  receiptNumber: z.number().int().positive().nullable(),
  reversesId: uuidSchema.nullable(),
  receivedBy: uuidSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type Payment = z.infer<typeof paymentSchema>;

export const createPaymentSchema = z.object({
  patientId: uuidSchema,
  amount: wholeMoneySchema.refine(
    (value) => Number(value) > 0,
    "A payment must be greater than zero",
  ),
  method: lookupCodeSchema,
  note: z.string().trim().max(500).nullish(),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const reversePaymentSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>;

export const listPaymentsQuerySchema = paginationQuerySchema.extend({
  patientId: uuidSchema.optional(),
});
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;

export const patientBalanceSchema = z.object({
  patientId: uuidSchema,
  charged: signedMoneySchema,
  paid: signedMoneySchema,
  balance: signedMoneySchema,
  lastPaymentAt: z.iso.datetime().nullable(),
});
export type PatientBalance = z.infer<typeof patientBalanceSchema>;

export const statementEntrySchema = z.object({
  id: uuidSchema,
  kind: z.enum(LEDGER_ENTRY_KINDS),
  occurredAt: z.iso.datetime(),
  description: z.string(),
  amount: signedMoneySchema,
  runningBalance: signedMoneySchema,
  receiptNumber: z.number().int().positive().nullable(),
  isReversal: z.boolean(),
  isReversed: z.boolean(),
  note: z.string().nullable(),
  deletedAt: z.iso.datetime().optional(),
  deletedBy: personNameSchema.optional(),
});
export type StatementEntry = z.infer<typeof statementEntrySchema>;

export const statementSchema = z.object({
  patientId: uuidSchema,
  from: z.iso.datetime().nullable(),
  to: z.iso.datetime().nullable(),
  openingBalance: signedMoneySchema,
  closingBalance: signedMoneySchema,
  entries: z.array(statementEntrySchema),
});
export type Statement = z.infer<typeof statementSchema>;

export const statementQuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
export type StatementQuery = z.infer<typeof statementQuerySchema>;

export const overduePatientSchema = z.object({
  patientId: uuidSchema,
  fileNumber: z.string(),
  fullName: z.string(),
  phone: z.string(),
  balance: signedMoneySchema,
  lastPaymentAt: z.iso.datetime().nullable(),
  daysSinceLastPayment: z.number().int().nullable(),
});
export type OverduePatient = z.infer<typeof overduePatientSchema>;

export const DEFAULT_OVERDUE_AFTER_DAYS = 30;

export const listOverdueQuerySchema = paginationQuerySchema.extend({
  afterDays: z.coerce.number().int().min(1).max(365).optional(),
});
export type ListOverdueQuery = z.infer<typeof listOverdueQuerySchema>;

export const OVERDUE_AFTER_DAYS_SETTING = "overdueAfterDays";
