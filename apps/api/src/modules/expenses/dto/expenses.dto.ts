import { createZodDto } from "nestjs-zod";
import {
  createExpenseSchema,
  expenseQuerySchema,
  idParamSchema,
  reverseEntrySchema,
} from "@clinic/shared";

export class CreateExpenseDto extends createZodDto(createExpenseSchema) {}

export class ExpenseQueryDto extends createZodDto(expenseQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}

export class ReverseExpenseDto extends createZodDto(reverseEntrySchema) {}
