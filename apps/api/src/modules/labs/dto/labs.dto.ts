import { createZodDto } from "nestjs-zod";
import {
  createLabSchema,
  updateLabSchema,
  listLabsQuerySchema,
  idParamSchema,
  createLabWorkTypeSchema,
  updateLabWorkTypeSchema,
} from "@clinic/shared";
import { z } from "zod";

export class CreateLabDto extends createZodDto(createLabSchema) {}

export class UpdateLabDto extends createZodDto(updateLabSchema) {}

export class ListLabsQueryDto extends createZodDto(listLabsQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}

export class CreateWorkTypeDto extends createZodDto(createLabWorkTypeSchema) {}

export class UpdateWorkTypeDto extends createZodDto(updateLabWorkTypeSchema) {}

export class LabIdParamDto extends createZodDto(z.object({ labId: z.uuid() })) {}

export class WorkTypeQueryDto extends createZodDto(
  z.object({ includeInactive: z.coerce.boolean().optional() }),
) {}
