import { createZodDto } from "nestjs-zod";
import {
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  setPasswordSchema,
  requestLoginCodeSchema,
  verifyLoginCodeSchema,
  verifyPasskeyLoginSchema,
  registerPasskeySchema,
  googleCallbackQuerySchema,
  googleStartQuerySchema,
  idParamSchema,
} from "@clinic/shared";

export class LoginDto extends createZodDto(loginSchema) {}

export class RefreshDto extends createZodDto(refreshSchema) {}

export class LogoutDto extends createZodDto(logoutSchema) {}

export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}

export class SetPasswordDto extends createZodDto(setPasswordSchema) {}

export class RequestLoginCodeDto extends createZodDto(requestLoginCodeSchema) {}

export class VerifyLoginCodeDto extends createZodDto(verifyLoginCodeSchema) {}

export class VerifyPasskeyLoginDto extends createZodDto(verifyPasskeyLoginSchema) {}

export class RegisterPasskeyDto extends createZodDto(registerPasskeySchema) {}

export class GoogleStartQueryDto extends createZodDto(googleStartQuerySchema) {}

export class GoogleCallbackQueryDto extends createZodDto(googleCallbackQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
