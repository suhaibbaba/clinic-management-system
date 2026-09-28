import { createZodDto } from "nestjs-zod";
import {
  createLabPaymentSchema,
  reverseLabPaymentSchema,
  statementQuerySchema,
  paginationQuerySchema,
  idParamSchema,
} from "@clinic/shared";
import { z } from "zod";

export class CreateLabPaymentDto extends createZodDto(createLabPaymentSchema) {}

export class ReverseLabPaymentDto extends createZodDto(reverseLabPaymentSchema) {}

export class StatementQueryDto extends createZodDto(statementQuerySchema) {}

export class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}

export class LabIdParamDto extends createZodDto(z.object({ labId: z.uuid() })) {}
