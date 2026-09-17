import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  setPasswordSchema,
  type AuthTokens,
  type LoginResponse,
} from "@clinic/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createZodDto } from "nestjs-zod";

import { AccountInvitationsService } from "@api/email/account-invitations.service";
import { AuthService } from "@api/auth/auth.service";
import { clearRefreshCookie, readRefreshToken, setRefreshCookie } from "@api/auth/refresh-cookie";
import { Public } from "@api/common/decorators/public.decorator";
import type { Env } from "@api/config/env.schema";

class LoginDto extends createZodDto(loginSchema) {}
class RefreshDto extends createZodDto(refreshSchema) {}
class LogoutDto extends createZodDto(logoutSchema) {}
class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
class SetPasswordDto extends createZodDto(setPasswordSchema) {}

// All three are `@Public()` — they are how a caller obtains or discards credentials. The refresh
// token travels in an httpOnly cookie, never in a body.
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly invitations: AccountInvitationsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<LoginResponse> {
    const { refreshToken, ...response } = await this.authService.login(body);
    setRefreshCookie(reply, this.config, refreshToken);

    return response;
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: RefreshDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthTokens> {
    const presented = readRefreshToken(request, body.refreshToken);

    if (!presented) {
      throw new BadRequestException("Missing refresh token");
    }

    const { refreshToken, ...tokens } = await this.authService.refresh(presented);
    setRefreshCookie(reply, this.config, refreshToken);

    return tokens;
  }

  // Public and idempotent: a caller whose access token has already expired must still be able to
  // discard its refresh token.
  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body() body: LogoutDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const presented = readRefreshToken(request, body.refreshToken);

    if (presented) {
      await this.authService.logout(presented);
    }

    clearRefreshCookie(reply, this.config);
  }

  // Public by necessity: somebody who cannot sign in is asking for the way back in. Always 204,
  // whatever the identifier — telling a stranger which addresses have accounts here is the leak.
  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(@Body() body: ForgotPasswordDto): Promise<void> {
    await this.invitations.forgot(body.identifier);
  }

  @Public()
  @Post("set-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  async setPassword(@Body() body: SetPasswordDto): Promise<void> {
    await this.invitations.setPassword(body.token, body.password);
  }
}
