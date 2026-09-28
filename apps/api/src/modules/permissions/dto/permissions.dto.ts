import { createZodDto } from "nestjs-zod";
import { updateRolePermissionSchema } from "@clinic/shared";

export class UpdateRolePermissionDto extends createZodDto(updateRolePermissionSchema) {}
