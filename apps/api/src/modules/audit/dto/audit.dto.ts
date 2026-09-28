import { createZodDto } from "nestjs-zod";
import { listAuditLogQuerySchema } from "@clinic/shared";

export class ListAuditLogQueryDto extends createZodDto(listAuditLogQuerySchema) {}
