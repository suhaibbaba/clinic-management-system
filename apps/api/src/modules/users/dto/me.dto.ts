import { createZodDto } from "nestjs-zod";
import { changePasswordSchema, updateOwnProfileSchema } from "@clinic/shared";

export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}

export class UpdateOwnProfileDto extends createZodDto(updateOwnProfileSchema) {}
