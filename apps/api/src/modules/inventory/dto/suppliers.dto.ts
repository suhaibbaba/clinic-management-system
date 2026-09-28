import { createZodDto } from "nestjs-zod";
import {
  createSupplierSchema,
  updateSupplierSchema,
  listSuppliersQuerySchema,
  statementRangeQuerySchema,
  idParamSchema,
} from "@clinic/shared";

export class CreateSupplierDto extends createZodDto(createSupplierSchema) {}

export class UpdateSupplierDto extends createZodDto(updateSupplierSchema) {}

export class ListSuppliersQueryDto extends createZodDto(listSuppliersQuerySchema) {}

export class StatementQueryDto extends createZodDto(statementRangeQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
