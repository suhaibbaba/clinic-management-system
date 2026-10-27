import { createZodDto } from "nestjs-zod";
import {
  createSupplierPaymentSchema,
  idParamSchema,
  reverseSupplierPaymentSchema,
} from "@clinic/shared";

export class CreateSupplierPaymentDto extends createZodDto(createSupplierPaymentSchema) {}

export class ReverseSupplierPaymentDto extends createZodDto(reverseSupplierPaymentSchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
