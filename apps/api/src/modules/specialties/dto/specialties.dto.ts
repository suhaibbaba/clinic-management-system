import { createZodDto } from "nestjs-zod";
import { idParamSchema, listSpecialtiesQuerySchema, updateSpecialtySchema } from "@clinic/shared";

export class ListSpecialtiesQueryDto extends createZodDto(listSpecialtiesQuerySchema) {}

export class UpdateSpecialtyDto extends createZodDto(updateSpecialtySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
