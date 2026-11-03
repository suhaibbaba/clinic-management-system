import { createZodDto } from "nestjs-zod";
import { saveDashboardLayoutsSchema } from "@clinic/shared";

export class SaveDashboardLayoutsDto extends createZodDto(saveDashboardLayoutsSchema) {}
