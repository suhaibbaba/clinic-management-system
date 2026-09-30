import { createZodDto } from "nestjs-zod";
import {
  createTreatmentPlanSchema,
  updateTreatmentPlanSchema,
  listTreatmentPlansQuerySchema,
  idParamSchema,
} from "@clinic/shared";

export class CreateTreatmentPlanDto extends createZodDto(createTreatmentPlanSchema) {}

export class UpdateTreatmentPlanDto extends createZodDto(updateTreatmentPlanSchema) {}

export class ListTreatmentPlansQueryDto extends createZodDto(listTreatmentPlansQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
