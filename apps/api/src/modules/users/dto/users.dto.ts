import { createZodDto } from "nestjs-zod";
import {
  createUserSchema,
  updateUserSchema,
  resetUserPasswordSchema,
  listUsersQuerySchema,
  idParamSchema,
  presignUserPhotoSchema,
  confirmUserPhotoSchema,
} from "@clinic/shared";

export class CreateUserDto extends createZodDto(createUserSchema) {}

export class UpdateUserDto extends createZodDto(updateUserSchema) {}

export class ResetUserPasswordDto extends createZodDto(resetUserPasswordSchema) {}

export class ListUsersQueryDto extends createZodDto(listUsersQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}

export class PresignUserPhotoDto extends createZodDto(presignUserPhotoSchema) {}

export class ConfirmUserPhotoDto extends createZodDto(confirmUserPhotoSchema) {}
