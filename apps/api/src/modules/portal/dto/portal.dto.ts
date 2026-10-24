import { createZodDto } from "nestjs-zod";
import {
  portalAttachmentParamSchema,
  portalPatientParamSchema,
  requestPortalCodeSchema,
  siteSlugParamSchema,
  startPortalSessionSchema,
} from "@clinic/shared";

export class PortalSlugParamDto extends createZodDto(siteSlugParamSchema) {}

export class RequestPortalCodeDto extends createZodDto(requestPortalCodeSchema) {}

export class StartPortalSessionDto extends createZodDto(startPortalSessionSchema) {}

export class PortalPatientParamDto extends createZodDto(portalPatientParamSchema) {}

export class PortalAttachmentParamDto extends createZodDto(portalAttachmentParamSchema) {}
