import { createZodDto } from "nestjs-zod";
import {
  createDoctorTimeOffSchema,
  updateDoctorTimeOffSchema,
  listDoctorTimeOffQuerySchema,
  scheduleConflictOptionsSchema,
  idParamSchema,
} from "@clinic/shared";
import { z } from "zod";

export class CreateDoctorTimeOffDto extends createZodDto(createDoctorTimeOffSchema) {}

export class UpdateDoctorTimeOffDto extends createZodDto(updateDoctorTimeOffSchema) {}

export class ListDoctorTimeOffQueryDto extends createZodDto(listDoctorTimeOffQuerySchema) {}

export class ConflictOptionsDto extends createZodDto(scheduleConflictOptionsSchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}

export class DoctorParamDto extends createZodDto(z.object({ doctorId: z.uuid() })) {}
