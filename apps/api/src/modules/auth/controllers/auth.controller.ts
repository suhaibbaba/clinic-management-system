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
import { Throttle } from "@nestjs/throttler";
import { ConfigService } from "@nestjs/config";
import { type AuthTokens, type LoginResponse } from "@clinic/shared";
import { type FastifyReply, type FastifyRequest } from "fastify";
import { AccountInvitationsService } from "@api/modules/email/services/account-invitations.service";
import { AuthService } from "@api/modules/auth/services/auth.service";
import { LoginCodeService } from "@api/modules/auth/services/login-code.service";
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
  RequestLoginCodeDto,
  VerifyLoginCodeDto,
} from "@api/modules/auth/dto/auth.dto";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginCodes: LoginCodeService,
    private readonly invitations: AccountInvitationsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post("login-code")
  @HttpCode(HttpStatus.NO_CONTENT)
  async requestLoginCode(@Body() body: RequestLoginCodeDto): Promise<void> {
    await this.loginCodes.request(body.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login-code/verify")
  @HttpCode(HttpStatus.OK)
  async verifyLoginCode(
    @Body() body: VerifyLoginCodeDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<LoginResponse> {
    const { refreshToken, ...response } = await this.authService.loginWithCode(body);
    setRefreshCookie(reply, this.config, refreshToken);

    return response;
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
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
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post("forgot-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(@Body() body: ForgotPasswordDto): Promise<void> {
    await this.invitations.forgot(body.identifier);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @Post("set-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  async setPassword(@Body() body: SetPasswordDto): Promise<void> {
    await this.invitations.setPassword(body.token, body.password);
  }
}
