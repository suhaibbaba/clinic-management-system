import { z } from 'zod';

import { LEDGER_ENTRY_KINDS, PAYMENT_METHODS } from '@shared/enums';
import { paginationQuerySchema, uuidSchema } from '@shared/schemas/common';
import { moneySchema, signedMoneySchema } from '@shared/schemas/money';

/**
 * The money ledger.
 *
 * `charges` and `payments` are append-only (CLAUDE.md architecture decision 2).
 * Nothing here is ever edited: a correction is a new row carrying the negative
 * of the original and pointing at it through `reversesId`, so the history of
 * what was billed and why stays readable forever.
 *
 * A balance is therefore never stored — it is sum(charges) − sum(payments),
 * computed on read.
 */

export const chargeSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  patientId: uuidSchema,
  /** The work that caused it; null for a charge raised by hand. */
  performedProcedureId: uuidSchema.nullable(),
  amount: signedMoneySchema,
  discount: signedMoneySchema,
  discountReason: z.string().nullable(),
  note: z.string().nullable(),
  /** Set on a reversing entry: the charge this one cancels. */
  reversesId: uuidSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type Charge = z.infer<typeof chargeSchema>;

export const paymentSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  patientId: uuidSchema,
  amount: signedMoneySchema,
  method: z.enum(PAYMENT_METHODS),
  note: z.string().nullable(),
  /** Gapless per clinic; a reversal reuses no number of its own. */
  receiptNumber: z.number().int().positive().nullable(),
  reversesId: uuidSchema.nullable(),
  receivedBy: uuidSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type Payment = z.infer<typeof paymentSchema>;

/** Recording money taken in. The amount is always positive — see `reversePayment`. */
export const createPaymentSchema = z.object({
  patientId: uuidSchema,
  amount: moneySchema.refine((value) => Number(value) > 0, 'A payment must be greater than zero'),
  method: z.enum(PAYMENT_METHODS),
  note: z.string().trim().max(500).nullish(),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

/** Admin-only. Writes the opposite entry rather than touching the original. */
export const reversePaymentSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>;

export const listPaymentsQuerySchema = paginationQuerySchema.extend({
  patientId: uuidSchema.optional(),
});
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;

/**
 * What a patient owes.
 *
 * Computed by a SQL aggregate over the two ledgers on every read — there is no
 * stored balance anywhere in the system, and there never will be.
 */
export const patientBalanceSchema = z.object({
  patientId: uuidSchema,
  charged: signedMoneySchema,
  paid: signedMoneySchema,
  /** charged − paid. Positive means the patient owes the clinic. */
  balance: signedMoneySchema,
  lastPaymentAt: z.iso.datetime().nullable(),
});
export type PatientBalance = z.infer<typeof patientBalanceSchema>;

/**
 * One line of a statement.
 *
 * `description` deliberately carries no clinical detail beyond the procedure's
 * own name: a receptionist reads statements, and ROLES.md keeps diagnoses and
 * visit notes away from them.
 */
export const statementEntrySchema = z.object({
  id: uuidSchema,
  kind: z.enum(LEDGER_ENTRY_KINDS),
  occurredAt: z.iso.datetime(),
  description: z.string(),
  /** Positive on a charge, negative on a payment — as it hits the balance. */
  amount: signedMoneySchema,
  /** Balance after this line, oldest first. */
  runningBalance: signedMoneySchema,
  receiptNumber: z.number().int().positive().nullable(),
  isReversal: z.boolean(),
});
export type StatementEntry = z.infer<typeof statementEntrySchema>;

export const statementSchema = z.object({
  patientId: uuidSchema,
  from: z.iso.datetime().nullable(),
  to: z.iso.datetime().nullable(),
  /** Balance carried in from before `from`; zero when the range is open. */
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

/** A patient who owes money and has not paid recently. */
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

/** Days without a payment before a debt counts as overdue. */
export const DEFAULT_OVERDUE_AFTER_DAYS = 30;

export const listOverdueQuerySchema = paginationQuerySchema.extend({
  /** Overrides the clinic setting for one request. */
  afterDays: z.coerce.number().int().min(1).max(365).optional(),
});
export type ListOverdueQuery = z.infer<typeof listOverdueQuerySchema>;

/** Clinic settings key holding the overdue window. */
export const OVERDUE_AFTER_DAYS_SETTING = 'overdueAfterDays';
