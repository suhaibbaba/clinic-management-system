import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { FastifyReply } from "fastify";
import type { VendorProfile } from "@clinic/shared";
import { Public } from "@api/common/decorators/public.decorator";
import type { Env } from "@api/config/env.schema";
import { VENDOR_COOKIE_NAME } from "@api/modules/vendor/constants";
import { VendorLoginDto } from "@api/modules/vendor/dto/vendor.dto";
import { clearVendorCookie, setVendorCookie } from "@api/modules/vendor/lib/vendor-cookie";
import {
  VendorSession,
  type RequestWithVendor,
  type VendorSessionContext,
} from "@api/modules/vendor/lib/vendor-session";
import { VendorAuthService } from "@api/modules/vendor/services/vendor-auth.service";
import { VendorSessionGuard } from "@api/modules/vendor/services/vendor-session.guard";

@Controller("vendor/session")
@Public()
export class VendorAuthController {
  constructor(
    private readonly auth: VendorAuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() body: VendorLoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<VendorProfile> {
    const { token, expiresAt, profile } = await this.auth.login(body);

    setVendorCookie(reply, this.config, token, expiresAt);

    return profile;
  }

  @Get()
  @UseGuards(VendorSessionGuard)
  profile(@VendorSession() session: VendorSessionContext): VendorProfile {
    return { id: session.vendorUserId, email: session.email, name: session.name };
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: RequestWithVendor,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const token = request.cookies?.[VENDOR_COOKIE_NAME];

    if (token) {
      await this.auth.endSession(token);
    }

    clearVendorCookie(reply, this.config);
  }
}
