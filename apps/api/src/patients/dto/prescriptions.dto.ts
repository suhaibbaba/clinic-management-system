import { createZodDto } from "nestjs-zod";
import {
  createPrescriptionSchema,
  updatePrescriptionSchema,
  listPrescriptionsQuerySchema,
  idParamSchema,
} from "@clinic/shared";

export class CreatePrescriptionDto extends createZodDto(createPrescriptionSchema) {}

export class UpdatePrescriptionDto extends createZodDto(updatePrescriptionSchema) {}

export class ListPrescriptionsQueryDto extends createZodDto(listPrescriptionsQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
