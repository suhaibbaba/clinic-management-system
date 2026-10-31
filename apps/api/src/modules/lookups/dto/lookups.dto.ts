import { createZodDto } from "nestjs-zod";
import {
  createLookupOptionSchema,
  updateLookupOptionSchema,
  reorderLookupOptionsSchema,
  setLookupOptionsActiveSchema,
  listLookupOptionsQuerySchema,
  idParamSchema,
} from "@clinic/shared";

export class CreateLookupDto extends createZodDto(createLookupOptionSchema) {}

export class UpdateLookupDto extends createZodDto(updateLookupOptionSchema) {}

export class ReorderLookupsDto extends createZodDto(reorderLookupOptionsSchema) {}

export class SetLookupsActiveDto extends createZodDto(setLookupOptionsActiveSchema) {}

export class ListLookupsQueryDto extends createZodDto(listLookupOptionsQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
