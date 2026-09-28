import { createZodDto } from "nestjs-zod";
import {
  createProcedureCatalogItemSchema,
  updateProcedureCatalogItemSchema,
  listProcedureCatalogQuerySchema,
  idParamSchema,
} from "@clinic/shared";

export class CreateCatalogItemDto extends createZodDto(createProcedureCatalogItemSchema) {}

export class UpdateCatalogItemDto extends createZodDto(updateProcedureCatalogItemSchema) {}

export class ListCatalogQueryDto extends createZodDto(listProcedureCatalogQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
