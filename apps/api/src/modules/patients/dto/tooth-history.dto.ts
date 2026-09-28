import { createZodDto } from "nestjs-zod";
import { patientToothParamSchema } from "@clinic/shared";

export class PatientToothParamDto extends createZodDto(patientToothParamSchema) {}
