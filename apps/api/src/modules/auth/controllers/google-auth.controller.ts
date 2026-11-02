import { Controller, Get, Query, Req, Res, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { AUTH_ERROR } from "@clinic/shared";
import { type FastifyReply, type FastifyRequest } from "fastify";
import { Public } from "@api/common/decorators/public.decorator";
import { CurrentSite } from "@api/common/decorators/request-site.decorator";
import { type RequestSite } from "@api/common/types/request-site";
import { type Env } from "@api/config/env.schema";
import { GoogleCallbackQueryDto, GoogleStartQueryDto } from "@api/modules/auth/dto/auth.dto";
import { setRefreshCookie } from "@api/modules/auth/lib/refresh-cookie";
import {
  setGoogleStateCookie,
  takeGoogleStateCookie,
} from "@api/modules/auth/lib/google-state-cookie";
import { AuthService } from "@api/modules/auth/services/auth.service";
import { GoogleAuthService } from "@api/modules/auth/services/google-auth.service";

@Controller("auth/google")
export class GoogleAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly google: GoogleAuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get()
  async start(
    @Query() query: GoogleStartQueryDto,
    @CurrentSite() site: RequestSite,
    @Res() reply: FastifyReply,
  ): Promise<FastifyReply> {
    const started = await this.google.begin(site, query.remember !== "0");

    if (!started) {
      return reply.redirect(await this.failure(site, AUTH_ERROR.GOOGLE_FAILED), 302);
    }

    setGoogleStateCookie(reply, this.config, started.cookie);

    return reply.redirect(started.url, 302);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get("callback")
  async callback(
    @Query() query: GoogleCallbackQueryDto,
    @CurrentSite() site: RequestSite,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<FastifyReply> {
    const cookie = takeGoogleStateCookie(request, reply, this.config);
    const identity = await this.google.finish(site, query, cookie);

    if (!identity) {
      return reply.redirect(await this.failure(site, AUTH_ERROR.GOOGLE_FAILED), 302);
    }

    try {
      const { refreshToken, persistent } = await this.authService.loginWithGoogle(
        identity.email,
        identity.persistent,
        identity.clinicId,
      );
      setRefreshCookie(reply, this.config, refreshToken, persistent);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        return reply.redirect(await this.failure(site, AUTH_ERROR.GOOGLE_NO_ACCOUNT), 302);
      }

      throw error;
    }

    return reply.redirect(new URL("/", await this.google.homeFor(site)).toString(), 302);
  }

  private async failure(site: RequestSite, code: string): Promise<string> {
    const url = new URL("/login", await this.google.homeFor(site));
    url.searchParams.set("error", code);

    return url.toString();
  }
}
