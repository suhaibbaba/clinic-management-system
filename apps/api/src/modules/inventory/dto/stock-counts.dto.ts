import { createZodDto } from "nestjs-zod";
import { createStockCountSchema, idParamSchema, recordCountsSchema } from "@clinic/shared";

export class CreateStockCountDto extends createZodDto(createStockCountSchema) {}

export class RecordCountsDto extends createZodDto(recordCountsSchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
