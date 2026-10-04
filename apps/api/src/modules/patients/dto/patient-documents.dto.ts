import { createZodDto } from "nestjs-zod";
import { patientIdParamSchema } from "@clinic/shared";

export class PatientIdParamDto extends createZodDto(patientIdParamSchema) {}
