import { createZodDto } from "nestjs-zod";
import {
  createPatientSchema,
  updatePatientSchema,
  listPatientsQuerySchema,
  idParamSchema,
} from "@clinic/shared";

export class CreatePatientDto extends createZodDto(createPatientSchema) {}

export class UpdatePatientDto extends createZodDto(updatePatientSchema) {}

export class ListPatientsQueryDto extends createZodDto(listPatientsQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
