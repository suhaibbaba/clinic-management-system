import { createZodDto } from "nestjs-zod";
import {
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  setPasswordSchema,
} from "@clinic/shared";

export class LoginDto extends createZodDto(loginSchema) {}

export class RefreshDto extends createZodDto(refreshSchema) {}

export class LogoutDto extends createZodDto(logoutSchema) {}

export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}

export class SetPasswordDto extends createZodDto(setPasswordSchema) {}
