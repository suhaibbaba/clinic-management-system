import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  type RawBodyRequest,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { type FastifyRequest } from "fastify";
import { Public } from "@api/common/decorators/public.decorator";
import { type Env } from "@api/config/env.schema";
import { WHATSAPP_SIGNATURE_HEADER } from "@api/modules/notifications/constants";
import { isSignedBy } from "@api/modules/notifications/lib/whatsapp-checks";
import { WhatsAppChecksService } from "@api/modules/notifications/services/whatsapp-checks.service";

@Controller("public/whatsapp/webhook")
@Public()
@Throttle({ default: { limit: 600, ttl: 60_000 } })
export class WhatsAppWebhookController {
  constructor(
    private readonly checks: WhatsAppChecksService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  subscribe(
    @Query("hub.mode") mode: string | undefined,
    @Query("hub.verify_token") token: string | undefined,
    @Query("hub.challenge") challenge: string | undefined,
  ): string {
    const expected = this.config.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN", { infer: true });

    if (mode !== "subscribe" || !expected || token !== expected || !challenge) {
      throw new ForbiddenException();
    }

    return challenge;
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(
    @Req() request: RawBodyRequest<FastifyRequest>,
    @Headers(WHATSAPP_SIGNATURE_HEADER) signature: string | undefined,
    @Body() body: unknown,
  ): Promise<void> {
    const secret = this.config.get("WHATSAPP_APP_SECRET", { infer: true });

    if (!secret || !request.rawBody || !isSignedBy(secret, request.rawBody, signature)) {
      throw new ForbiddenException();
    }

    await this.checks.applyDeliveries(body);
  }
}
