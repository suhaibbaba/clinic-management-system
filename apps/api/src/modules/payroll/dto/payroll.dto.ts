import { createZodDto } from "nestjs-zod";
import {
  createPayrollAdjustmentSchema,
  createSalaryPaymentSchema,
  createStaffPaymentSchema,
  idParamSchema,
  payrollMonthParamSchema,
  reverseEntrySchema,
  salaryTermsInputSchema,
  settlementQuerySchema,
  settlementTermsSchema,
  updateTreatmentSettlementSchema,
} from "@clinic/shared";

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
