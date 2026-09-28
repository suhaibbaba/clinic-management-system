import { createZodDto } from "nestjs-zod";
import { listTimelineQuerySchema, patientIdParamSchema } from "@clinic/shared";

export class ListTimelineQueryDto extends createZodDto(listTimelineQuerySchema) {}

export class PatientIdParamDto extends createZodDto(patientIdParamSchema) {}
