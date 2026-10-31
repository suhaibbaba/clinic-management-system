import { createZodDto } from "nestjs-zod";
import {
  createProcedureCatalogItemSchema,
  updateProcedureCatalogItemSchema,
  listProcedureCatalogQuerySchema,
  removeProcedureCatalogItemsSchema,
  setProcedureCatalogItemsActiveSchema,
  idParamSchema,
} from "@clinic/shared";

export class CreateCatalogItemDto extends createZodDto(createProcedureCatalogItemSchema) {}

export class UpdateCatalogItemDto extends createZodDto(updateProcedureCatalogItemSchema) {}

export class SetCatalogItemsActiveDto extends createZodDto(setProcedureCatalogItemsActiveSchema) {}

export class RemoveCatalogItemsDto extends createZodDto(removeProcedureCatalogItemsSchema) {}

export class ListCatalogQueryDto extends createZodDto(listProcedureCatalogQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
