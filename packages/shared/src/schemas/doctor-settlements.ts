import { z } from "zod";
import { LAB_COST_BEARERS, PAY_BASES, SETTLEMENT_LINE_STATUSES } from "@shared/enums";
import { calendarDateSchema, uuidSchema } from "@shared/schemas/common";
import { lookupCodeSchema } from "@shared/schemas/lookups";
import { moneySchema, signedMoneySchema, wholeMoneySchema } from "@shared/schemas/money";
import { payrollMonthSchema, staffPaymentSchema } from "@shared/schemas/payroll";
import { clinicSharePercentSchema } from "@shared/schemas/doctors";
import { personNameSchema } from "@shared/schemas/person-name";

export const settlementQuerySchema = z
  .object({
    from: calendarDateSchema,
    to: calendarDateSchema,
    status: z.enum(SETTLEMENT_LINE_STATUSES).optional(),
  })
  .refine((query) => query.to >= query.from, {
    message: "to must not be before from",
    path: ["to"],
  });
export type SettlementQuery = z.infer<typeof settlementQuerySchema>;

export const settlementTermsSchema = z.object({
  clinicSharePercent: clinicSharePercentSchema,
  effectiveMonth: payrollMonthSchema,
});
export type SettlementTermsInput = z.infer<typeof settlementTermsSchema>;

export const workPercentSchema = z.number().gt(0).max(100);

export const shareSplitEntrySchema = z.object({
  doctorId: uuidSchema,
  workPercent: workPercentSchema,
});
export type ShareSplitEntry = z.infer<typeof shareSplitEntrySchema>;

export const SHARE_SPLIT_TOTAL = 100;

export const shareSplitSchema = z
  .array(shareSplitEntrySchema)
  .min(2)
  .max(4)
  .refine(
    (entries) => new Set(entries.map((entry) => entry.doctorId)).size === entries.length,
    "A doctor may appear once in a split",
  )
  .refine(
    (entries) =>
      Math.abs(entries.reduce((sum, entry) => sum + entry.workPercent, 0) - SHARE_SPLIT_TOTAL) <
      0.001,
    "The work shares must add up to 100",
  );
export type ShareSplit = z.infer<typeof shareSplitSchema>;

export const updateTreatmentSettlementSchema = z
  .object({
    materialCost: wholeMoneySchema.nullable(),
    clinicSharePercent: clinicSharePercentSchema.nullable(),
    shareSplit: shareSplitSchema.nullable(),
    shareWaivedReason: z.string().trim().min(3).max(500).nullable(),
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field must be provided");
export type UpdateTreatmentSettlementInput = z.infer<typeof updateTreatmentSettlementSchema>;

export const settlementTreatmentSchema = z.object({
  id: uuidSchema,
  doctorId: uuidSchema,
  performedAt: z.iso.datetime(),
  patientId: uuidSchema,
  patientName: z.string(),
  fileNumber: z.string().nullable(),
  procedureName: z.string(),
  price: moneySchema,
  discount: moneySchema,
  revenue: signedMoneySchema,
  taxPercent: z.number(),
  tax: signedMoneySchema,
  overheadPercent: z.number(),
  overhead: signedMoneySchema,
  suggestedMaterialCost: moneySchema,
  materialCost: moneySchema,
  materialCostSet: z.boolean(),
  workPercent: z.number(),
  split: z.array(shareSplitEntrySchema).nullable(),
  clinicSharePercent: clinicSharePercentSchema,
  clinicSharePercentSet: z.boolean(),
  net: signedMoneySchema,
  clinicShare: signedMoneySchema,
  doctorShare: signedMoneySchema,
  waivedReason: z.string().nullable(),
  collectedPercent: z.number(),
  payable: signedMoneySchema,
  paid: signedMoneySchema,
  outstanding: signedMoneySchema,
  status: z.enum(SETTLEMENT_LINE_STATUSES),
});
export type SettlementTreatment = z.infer<typeof settlementTreatmentSchema>;

export const settlementTotalsSchema = z.object({
  revenue: signedMoneySchema,
  tax: signedMoneySchema,
  overhead: signedMoneySchema,
  materials: signedMoneySchema,
  net: signedMoneySchema,
  clinicShare: signedMoneySchema,
  doctorShare: signedMoneySchema,
  payable: signedMoneySchema,
  paid: signedMoneySchema,
  outstanding: signedMoneySchema,
});
export type SettlementTotals = z.infer<typeof settlementTotalsSchema>;

export const settlementItemSchema = z.object({
  treatmentId: uuidSchema,
  patientId: uuidSchema,
  patientName: z.string(),
  fileNumber: z.string().nullable(),
  procedureName: z.string(),
  performedAt: z.iso.datetime(),
  amount: signedMoneySchema,
});
export type SettlementItem = z.infer<typeof settlementItemSchema>;

export const settlementPayoutSchema = staffPaymentSchema.extend({
  items: z.array(settlementItemSchema),
});
export type SettlementPayout = z.infer<typeof settlementPayoutSchema>;

export const doctorSettlementSchema = z.object({
  doctorId: uuidSchema,
  from: calendarDateSchema,
  to: calendarDateSchema,
  clinicSharePercent: clinicSharePercentSchema,
  onPercentage: z.boolean(),
  basis: z.enum(PAY_BASES),
  labCostBearer: z.enum(LAB_COST_BEARERS),
  treatments: z.array(settlementTreatmentSchema),
  totals: settlementTotalsSchema,
  payouts: z.array(settlementPayoutSchema),
  earned: signedMoneySchema,
  paid: signedMoneySchema,
  balance: signedMoneySchema,
});
export type DoctorSettlement = z.infer<typeof doctorSettlementSchema>;

export const createSettlementPayoutSchema = z
  .object({
    method: lookupCodeSchema,
    note: z.string().trim().max(500).nullish(),
    treatmentIds: z.array(uuidSchema).max(1000).default([]),
    amount: wholeMoneySchema
      .refine((value) => Number(value) > 0, "An amount must be greater than zero")
      .optional(),
  })
  .refine((input) => input.treatmentIds.length > 0 !== (input.amount !== undefined), {
    message: "Choose treatments to settle, or give an advance amount, not both",
    path: ["treatmentIds"],
  });
export type CreateSettlementPayoutInput = z.input<typeof createSettlementPayoutSchema>;

export const ownSettlementLineSchema = settlementTreatmentSchema.pick({
  id: true,
  performedAt: true,
  patientId: true,
  patientName: true,
  fileNumber: true,
  procedureName: true,
  revenue: true,
  workPercent: true,
  doctorShare: true,
  waivedReason: true,
  collectedPercent: true,
  payable: true,
  paid: true,
  outstanding: true,
  status: true,
});
export type OwnSettlementLine = z.infer<typeof ownSettlementLineSchema>;

export const ownSettlementSchema = z.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
  basis: z.enum(PAY_BASES),
  lines: z.array(ownSettlementLineSchema),
  totals: settlementTotalsSchema.pick({ payable: true, paid: true, outstanding: true }),
  payouts: z.array(settlementPayoutSchema),
  earned: signedMoneySchema,
  paid: signedMoneySchema,
  balance: signedMoneySchema,
});
export type OwnSettlement = z.infer<typeof ownSettlementSchema>;

export const treatmentSettlementStatusSchema = z.object({
  treatmentId: uuidSchema,
  doctorId: uuidSchema,
  doctorName: personNameSchema,
  payable: signedMoneySchema,
  paid: signedMoneySchema,
  status: z.enum(SETTLEMENT_LINE_STATUSES),
  lastPaidAt: z.iso.datetime().nullable(),
});
export type TreatmentSettlementStatus = z.infer<typeof treatmentSettlementStatusSchema>;
