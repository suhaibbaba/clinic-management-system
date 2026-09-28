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
import { type AuthTokens, type LoginResponse } from "@clinic/shared";
import { type FastifyReply, type FastifyRequest } from "fastify";
import { AccountInvitationsService } from "@api/modules/email/services/account-invitations.service";
import { AuthService } from "@api/modules/auth/services/auth.service";
import {
  clearRefreshCookie,
  readRefreshToken,
  setRefreshCookie,
} from "@api/modules/auth/lib/refresh-cookie";
import { Public } from "@api/common/decorators/public.decorator";
import { type Env } from "@api/config/env.schema";
import {
  LoginDto,
  RefreshDto,
  LogoutDto,
  ForgotPasswordDto,
  SetPasswordDto,
} from "@api/modules/auth/dto/auth.dto";

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
