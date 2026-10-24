import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { FastifyReply } from "fastify";
import type {
  PortalAccount,
  PortalCodeReceipt,
  PortalFileLink,
  PortalRecord,
} from "@clinic/shared";
import { Public } from "@api/common/decorators/public.decorator";
import type { Env } from "@api/config/env.schema";
import { PORTAL_COOKIE_NAME } from "@api/modules/portal/constants";
import {
  PortalAttachmentParamDto,
  PortalPatientParamDto,
  PortalSlugParamDto,
  RequestPortalCodeDto,
  StartPortalSessionDto,
} from "@api/modules/portal/dto/portal.dto";
import { clearPortalCookie, setPortalCookie } from "@api/modules/portal/lib/portal-cookie";
import {
  PortalSession,
  type PortalSessionContext,
  type RequestWithPortal,
} from "@api/modules/portal/lib/portal-session";
import { PortalAuthService } from "@api/modules/portal/services/portal-auth.service";
import { PortalRecordsService } from "@api/modules/portal/services/portal-records.service";
import { PortalSessionGuard } from "@api/modules/portal/services/portal-session.guard";

@Controller("public/portal")
@Public()
export class PortalController {
  constructor(
    private readonly auth: PortalAuthService,
    private readonly records: PortalRecordsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post(":clinicSlug/code")
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  requestCode(
    @Param() params: PortalSlugParamDto,
    @Body() body: RequestPortalCodeDto,
  ): Promise<PortalCodeReceipt> {
    return this.auth.requestCode(params.clinicSlug, body.phone);
  }

  @Post(":clinicSlug/session")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async startSession(
    @Param() params: PortalSlugParamDto,
    @Body() body: StartPortalSessionDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<PortalAccount> {
    const { token, account } = await this.auth.startSession(
      params.clinicSlug,
      body.phone,
      body.code,
    );

    setPortalCookie(reply, this.config, token, new Date(account.expiresAt));

    return account;
  }

  @Get("account")
  @UseGuards(PortalSessionGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  account(@PortalSession() session: PortalSessionContext): Promise<PortalAccount> {
    return this.auth.account(session);
  }

  @Get("patients/:patientId")
  @UseGuards(PortalSessionGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  record(
    @PortalSession() session: PortalSessionContext,
    @Param() params: PortalPatientParamDto,
  ): Promise<PortalRecord> {
    return this.records.record(session, params.patientId);
  }

  @Get("patients/:patientId/attachments/:attachmentId/link")
  @UseGuards(PortalSessionGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  fileLink(
    @PortalSession() session: PortalSessionContext,
    @Param() params: PortalAttachmentParamDto,
  ): Promise<PortalFileLink> {
    return this.records.fileLink(session, params.patientId, params.attachmentId);
  }

  @Delete("session")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async endSession(
    @Req() request: RequestWithPortal,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const token = request.cookies?.[PORTAL_COOKIE_NAME];

    if (token) {
      await this.auth.endSession(token);
    }

    clearPortalCookie(reply, this.config);
  }
}
