import { createZodDto } from "nestjs-zod";
import { listSpecialtiesQuerySchema } from "@clinic/shared";

export class ListSpecialtiesQueryDto extends createZodDto(listSpecialtiesQuerySchema) {}
