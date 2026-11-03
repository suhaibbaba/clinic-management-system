import { createZodDto } from "nestjs-zod";
import {
  createContactMessageSchema,
  idParamSchema,
  listContactMessagesQuerySchema,
  presignSiteImageSchema,
  siteDocumentSchema,
  siteSlugParamSchema,
  updateContactMessageSchema,
} from "@clinic/shared";

export class SiteDocumentDto extends createZodDto(siteDocumentSchema) {}

export class PresignSiteImageDto extends createZodDto(presignSiteImageSchema) {}

export class SiteSlugParamDto extends createZodDto(siteSlugParamSchema) {}

export class CreateContactMessageDto extends createZodDto(createContactMessageSchema) {}

export class ListContactMessagesQueryDto extends createZodDto(listContactMessagesQuerySchema) {}

export class UpdateContactMessageDto extends createZodDto(updateContactMessageSchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
