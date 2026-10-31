import {
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  type RawBodyRequest,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { type FastifyRequest } from "fastify";
import { Public } from "@api/common/decorators/public.decorator";
import { type Env } from "@api/config/env.schema";
import { TWILIO_SIGNATURE_HEADER } from "@api/modules/notifications/constants";
import { isTwilioSigned, twilioStatusFrom } from "@api/modules/notifications/lib/twilio";
import { WhatsAppChecksService } from "@api/modules/notifications/services/whatsapp-checks.service";

@Controller("public/twilio/status")
@Public()
@Throttle({ default: { limit: 600, ttl: 60_000 } })
export class TwilioWebhookController {
  constructor(
    private readonly checks: WhatsAppChecksService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async receive(
    @Req() request: RawBodyRequest<FastifyRequest>,
    @Headers(TWILIO_SIGNATURE_HEADER) signature: string | undefined,
  ): Promise<void> {
    const authToken = this.config.get("TWILIO_AUTH_TOKEN", { infer: true });
    const url = this.config.get("TWILIO_STATUS_CALLBACK_URL", { infer: true });
    const params = new URLSearchParams(request.rawBody?.toString("utf8") ?? "");

    if (
      !authToken ||
      !url ||
      !request.rawBody ||
      !isTwilioSigned(authToken, url, params, signature)
    ) {
      throw new ForbiddenException();
    }

    const delivery = twilioStatusFrom(params);

    if (delivery) {
      await this.checks.applyTwilioDelivery(delivery);
    }
  }
}
