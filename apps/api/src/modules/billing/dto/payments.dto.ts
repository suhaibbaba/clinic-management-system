import { createZodDto } from "nestjs-zod";
import {
  createPaymentSchema,
  reversePaymentSchema,
  listPaymentsQuerySchema,
  idParamSchema,
} from "@clinic/shared";

export class CreatePaymentDto extends createZodDto(createPaymentSchema) {}

export class ReversePaymentDto extends createZodDto(reversePaymentSchema) {}

export class ListPaymentsQueryDto extends createZodDto(listPaymentsQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
