import { createZodDto } from "nestjs-zod";
import {
  createDoctorExtraHoursSchema,
  listDoctorExtraHoursQuerySchema,
  idParamSchema,
} from "@clinic/shared";
import { z } from "zod";

export class CreateDoctorExtraHoursDto extends createZodDto(createDoctorExtraHoursSchema) {}

export class ListDoctorExtraHoursQueryDto extends createZodDto(listDoctorExtraHoursQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}

export class DoctorParamDto extends createZodDto(z.object({ doctorId: z.uuid() })) {}
