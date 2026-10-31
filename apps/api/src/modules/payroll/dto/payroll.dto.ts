import { createZodDto } from "nestjs-zod";
import {
  collectionTermsInputSchema,
  createPayrollAdjustmentSchema,
  createRemittanceSchema,
  createSalaryPaymentSchema,
  createSettlementPayoutSchema,
  createStaffPaymentSchema,
  idParamSchema,
  payPlanInputSchema,
  payRulesInputSchema,
  payrollMonthParamSchema,
  reverseEntrySchema,
  salaryTermsInputSchema,
  settlementQuerySchema,
  settlementTermsSchema,
  shareTermsInputSchema,
  updateTreatmentSettlementSchema,
  uuidSchema,
} from "@clinic/shared";
import { z } from "zod";

export class IdParamDto extends createZodDto(idParamSchema) {}

export class MonthParamDto extends createZodDto(payrollMonthParamSchema) {}

export class SettlementQueryDto extends createZodDto(settlementQuerySchema) {}

export class SettlementTermsDto extends createZodDto(settlementTermsSchema) {}

export class UpdateTreatmentSettlementDto extends createZodDto(updateTreatmentSettlementSchema) {}

export class CreateStaffPaymentDto extends createZodDto(createStaffPaymentSchema) {}

export class CreateSalaryPaymentDto extends createZodDto(createSalaryPaymentSchema) {}

export class ReverseEntryDto extends createZodDto(reverseEntrySchema) {}

export class SalaryTermsDto extends createZodDto(salaryTermsInputSchema) {}

export class CreatePayrollAdjustmentDto extends createZodDto(createPayrollAdjustmentSchema) {}

export class CreateSettlementPayoutDto extends createZodDto(createSettlementPayoutSchema) {}

export class CreateRemittanceDto extends createZodDto(createRemittanceSchema) {}

export class CollectionTermsDto extends createZodDto(collectionTermsInputSchema) {}

export class PayRulesDto extends createZodDto(payRulesInputSchema) {}

export class PayPlanDto extends createZodDto(payPlanInputSchema) {}

export class ShareTermsDto extends createZodDto(shareTermsInputSchema) {}

export class PayoutParamDto extends createZodDto(
  z.object({ id: uuidSchema, payoutId: uuidSchema }),
) {}

export class OwnSettlementQueryDto extends createZodDto(settlementQuerySchema) {}
