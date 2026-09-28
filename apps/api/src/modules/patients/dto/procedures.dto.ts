import { createZodDto } from "nestjs-zod";
import {
  createPerformedProcedureSchema,
  updatePerformedProcedureSchema,
  listPerformedProceduresQuerySchema,
  idParamSchema,
} from "@clinic/shared";

export class CreateProcedureDto extends createZodDto(createPerformedProcedureSchema) {}

export class UpdateProcedureDto extends createZodDto(updatePerformedProcedureSchema) {}

export class ListProceduresQueryDto extends createZodDto(listPerformedProceduresQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
