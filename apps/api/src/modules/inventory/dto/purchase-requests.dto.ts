import { createZodDto } from "nestjs-zod";
import {
  cancelPurchaseRequestSchema,
  createPurchaseRequestSchema,
  idParamSchema,
  listPurchaseRequestsQuerySchema,
  requestBelowMinimumSchema,
  sendPurchaseRequestSchema,
  updatePurchaseRequestSchema,
} from "@clinic/shared";

export class CreatePurchaseRequestDto extends createZodDto(createPurchaseRequestSchema) {}

export class UpdatePurchaseRequestDto extends createZodDto(updatePurchaseRequestSchema) {}

export class RequestBelowMinimumDto extends createZodDto(requestBelowMinimumSchema) {}

export class SendPurchaseRequestDto extends createZodDto(sendPurchaseRequestSchema) {}

export class CancelPurchaseRequestDto extends createZodDto(cancelPurchaseRequestSchema) {}

export class ListPurchaseRequestsQueryDto extends createZodDto(listPurchaseRequestsQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
