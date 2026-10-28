import { createZodDto } from "nestjs-zod";
import {
  idParamSchema,
  invoiceReceiptsSchema,
  postPurchaseSchema,
  reallocatePaymentSchema,
  supplierRefundSchema,
  voidDocumentSchema,
} from "@clinic/shared";

export class PostPurchaseDto extends createZodDto(postPurchaseSchema) {}

export class InvoiceReceiptsDto extends createZodDto(invoiceReceiptsSchema) {}

export class VoidDocumentDto extends createZodDto(voidDocumentSchema) {}

export class ReallocatePaymentDto extends createZodDto(reallocatePaymentSchema) {}

export class SupplierRefundDto extends createZodDto(supplierRefundSchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
