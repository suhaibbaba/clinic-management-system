import { createZodDto } from "nestjs-zod";
import {
  createClinicClosureSchema,
  updateClinicClosureSchema,
  listClinicClosuresQuerySchema,
  scheduleConflictOptionsSchema,
  idParamSchema,
} from "@clinic/shared";

export class CreateClinicClosureDto extends createZodDto(createClinicClosureSchema) {}

export class UpdateClinicClosureDto extends createZodDto(updateClinicClosureSchema) {}

export class ListClinicClosuresQueryDto extends createZodDto(listClinicClosuresQuerySchema) {}

export class ConflictOptionsDto extends createZodDto(scheduleConflictOptionsSchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
