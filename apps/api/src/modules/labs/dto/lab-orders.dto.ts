import { createZodDto } from "nestjs-zod";
import {
  createLabOrderSchema,
  updateLabOrderSchema,
  listLabOrdersQuerySchema,
  labOrderStageCountsQuerySchema,
  returnLabOrderSchema,
  idParamSchema,
  presignLabAttachmentSchema,
  confirmLabAttachmentSchema,
} from "@clinic/shared";
import { z } from "zod";

export class CreateLabOrderDto extends createZodDto(createLabOrderSchema) {}

export class UpdateLabOrderDto extends createZodDto(updateLabOrderSchema) {}

export class ListLabOrdersQueryDto extends createZodDto(listLabOrdersQuerySchema) {}

export class StageCountsQueryDto extends createZodDto(labOrderStageCountsQuerySchema) {}

export class ReturnLabOrderDto extends createZodDto(returnLabOrderSchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}

export class PresignDto extends createZodDto(presignLabAttachmentSchema) {}

export class ConfirmDto extends createZodDto(confirmLabAttachmentSchema) {}

export class AttachmentParamsDto extends createZodDto(
  z.object({ id: z.uuid(), attachmentId: z.uuid() }),
) {}
