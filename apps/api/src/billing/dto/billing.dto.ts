import { createZodDto } from "nestjs-zod";
import { patientIdParamSchema, statementQuerySchema, listOverdueQuerySchema } from "@clinic/shared";

export class PatientIdParamDto extends createZodDto(patientIdParamSchema) {}

export class StatementQueryDto extends createZodDto(statementQuerySchema) {}

export class ListOverdueQueryDto extends createZodDto(listOverdueQuerySchema) {}
