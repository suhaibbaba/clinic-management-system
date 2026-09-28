import { createZodDto } from "nestjs-zod";
import {
  createDoctorSchema,
  createVisitingDoctorSchema,
  updateDoctorSchema,
  updateDoctorScheduleSchema,
  listDoctorsQuerySchema,
  idParamSchema,
} from "@clinic/shared";

export class CreateDoctorDto extends createZodDto(createDoctorSchema) {}

export class CreateVisitingDoctorDto extends createZodDto(createVisitingDoctorSchema) {}

export class UpdateDoctorDto extends createZodDto(updateDoctorSchema) {}

export class UpdateDoctorScheduleDto extends createZodDto(updateDoctorScheduleSchema) {}

export class ListDoctorsQueryDto extends createZodDto(listDoctorsQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
