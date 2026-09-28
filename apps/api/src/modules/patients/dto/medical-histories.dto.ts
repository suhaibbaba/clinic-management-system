import { createZodDto } from "nestjs-zod";
import { updateMedicalHistorySchema, patientIdParamSchema } from "@clinic/shared";

export class UpdateMedicalHistoryDto extends createZodDto(updateMedicalHistorySchema) {}

export class PatientIdParamDto extends createZodDto(patientIdParamSchema) {}
