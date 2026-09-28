import { createZodDto } from "nestjs-zod";
import {
  createVisitSchema,
  updateVisitSchema,
  listVisitsQuerySchema,
  idParamSchema,
} from "@clinic/shared";

export class CreateVisitDto extends createZodDto(createVisitSchema) {}

export class UpdateVisitDto extends createZodDto(updateVisitSchema) {}

export class ListVisitsQueryDto extends createZodDto(listVisitsQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
