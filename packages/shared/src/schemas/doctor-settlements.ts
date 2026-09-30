import { z } from "zod";
import { calendarDateSchema, uuidSchema } from "@shared/schemas/common";
import { moneySchema, signedMoneySchema, wholeMoneySchema } from "@shared/schemas/money";
import { staffPaymentSchema } from "@shared/schemas/payroll";
import { clinicSharePercentSchema } from "@shared/schemas/doctors";

export const settlementQuerySchema = z
  .object({ from: calendarDateSchema, to: calendarDateSchema })
  .refine((query) => query.to >= query.from, {
    message: "to must not be before from",
    path: ["to"],
  });
export type SettlementQuery = z.infer<typeof settlementQuerySchema>;

export const settlementTermsSchema = z.object({
  clinicSharePercent: clinicSharePercentSchema,
});
export type SettlementTermsInput = z.infer<typeof settlementTermsSchema>;

export const updateTreatmentSettlementSchema = z
  .object({
    materialCost: wholeMoneySchema.nullable(),
    clinicSharePercent: clinicSharePercentSchema.nullable(),
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field must be provided");
export type UpdateTreatmentSettlementInput = z.infer<typeof updateTreatmentSettlementSchema>;

export const settlementTreatmentSchema = z.object({
  id: uuidSchema,
  performedAt: z.iso.datetime(),
  patientId: uuidSchema,
  patientName: z.string(),
  procedureName: z.string(),
  price: moneySchema,
  discount: moneySchema,
  suggestedMaterialCost: moneySchema,
  materialCost: moneySchema,
  materialCostSet: z.boolean(),
  clinicSharePercent: clinicSharePercentSchema,
  clinicSharePercentSet: z.boolean(),
  net: signedMoneySchema,
  clinicShare: signedMoneySchema,
  doctorShare: signedMoneySchema,
});
export type SettlementTreatment = z.infer<typeof settlementTreatmentSchema>;

export const settlementTotalsSchema = z.object({
  revenue: signedMoneySchema,
  materials: signedMoneySchema,
  net: signedMoneySchema,
  clinicShare: signedMoneySchema,
  doctorShare: signedMoneySchema,
});
export type SettlementTotals = z.infer<typeof settlementTotalsSchema>;

export const doctorSettlementSchema = z.object({
  doctorId: uuidSchema,
  from: calendarDateSchema,
  to: calendarDateSchema,
  clinicSharePercent: clinicSharePercentSchema,
  treatments: z.array(settlementTreatmentSchema),
  totals: settlementTotalsSchema,
  payouts: z.array(staffPaymentSchema),
  earned: signedMoneySchema,
  paid: signedMoneySchema,
  balance: signedMoneySchema,
});
export type DoctorSettlement = z.infer<typeof doctorSettlementSchema>;
