import { createZodDto } from "nestjs-zod";
import {
  createTreatmentPlanSchema,
  updateTreatmentPlanSchema,
  createTreatmentPlanItemSchema,
  updateTreatmentPlanItemSchema,
  convertPlanItemSchema,
  listTreatmentPlansQuerySchema,
  idParamSchema,
} from "@clinic/shared";

export class CreateTreatmentPlanDto extends createZodDto(createTreatmentPlanSchema) {}

export class UpdateTreatmentPlanDto extends createZodDto(updateTreatmentPlanSchema) {}

export class CreatePlanItemDto extends createZodDto(createTreatmentPlanItemSchema) {}

export class UpdatePlanItemDto extends createZodDto(updateTreatmentPlanItemSchema) {}

export class ConvertPlanItemDto extends createZodDto(convertPlanItemSchema) {}

export class ListTreatmentPlansQueryDto extends createZodDto(listTreatmentPlansQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
