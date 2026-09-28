import { createZodDto } from "nestjs-zod";
import {
  presignAttachmentUploadSchema,
  confirmAttachmentUploadSchema,
  listAttachmentsQuerySchema,
  patientIdParamSchema,
  idParamSchema,
} from "@clinic/shared";

export class PresignUploadDto extends createZodDto(presignAttachmentUploadSchema) {}

export class ConfirmUploadDto extends createZodDto(confirmAttachmentUploadSchema) {}

export class ListAttachmentsQueryDto extends createZodDto(listAttachmentsQuerySchema) {}

export class PatientIdParamDto extends createZodDto(patientIdParamSchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
