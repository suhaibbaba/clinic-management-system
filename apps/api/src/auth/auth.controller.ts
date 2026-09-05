import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  type AuthTokens,
  type LoginResponse,
} from '@clinic/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createZodDto } from 'nestjs-zod';

import { AuthService } from '@api/auth/auth.service';
import { clearRefreshCookie, readRefreshToken, setRefreshCookie } from '@api/auth/refresh-cookie';
import { Public } from '@api/common/decorators/public.decorator';
import type { Env } from '@api/config/env.schema';

class LoginDto extends createZodDto(loginSchema) {}
class RefreshDto extends createZodDto(refreshSchema) {}
class LogoutDto extends createZodDto(logoutSchema) {}

/**
 * Session endpoints. All three are `@Public()`: they are how a caller obtains
 * or discards credentials, so they cannot require one.
 *
 * The refresh token travels in an httpOnly cookie and is never included in a
 * response body — a browser therefore cannot read it from JavaScript. Clients
 * that cannot hold cookies may still pass it in the request body instead.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Post('login')
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
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: RefreshDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthTokens> {
    const presented = readRefreshToken(request, body.refreshToken);

    if (!presented) {
      throw new BadRequestException('Missing refresh token');
    }

    const { refreshToken, ...tokens } = await this.authService.refresh(presented);
    setRefreshCookie(reply, this.config, refreshToken);

    return tokens;
  }

  /**
   * Public and idempotent: a client whose access token has already expired must
   * still be able to discard its refresh token.
   */
  @Public()
  @Post('logout')
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
}
