import { randomInt } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  isMobilePhone,
  NOTIFICATION_CHANNEL,
  WHATSAPP_CHECK_ERROR,
  WHATSAPP_STATUS,
  WHATSAPP_STATUS_SOURCE,
  type WhatsAppCheck,
  type WhatsAppStatus,
} from "@clinic/shared";
import { and, eq, ne, type SQL } from "drizzle-orm";
import { hashCode } from "@api/common/lib/codes";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { type WhatsAppCredentials } from "@api/common/types/whatsapp";
import { type Env } from "@api/config/env.schema";
import { DATABASE, type Database } from "@api/database/database.module";
import { whatsAppChecks } from "@api/database/schema";
import { NOTIFICATION_PROVIDER, WHATSAPP_CODE_TTL_MS } from "@api/modules/notifications/constants";
import {
  whatsAppCredentials,
  type NotificationProvider,
} from "@api/modules/notifications/lib/notification-provider";
import {
  deliveryStatuses,
  shouldSendCheck,
  toWhatsAppCheck,
  whatsAppStatusOf,
} from "@api/modules/notifications/lib/whatsapp-checks";
import { whatsAppStatusOfTwilio, type TwilioStatus } from "@api/modules/notifications/lib/twilio";
import {
  TwilioNotificationProvider,
  WhatsAppNotificationProvider,
} from "@api/modules/notifications/services/notification-provider";
import { SecretsService } from "@api/modules/secrets/services/secrets.service";

@Injectable()
export class WhatsAppChecksService {
  private readonly logger = new Logger(WhatsAppChecksService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(NOTIFICATION_PROVIDER) private readonly provider: NotificationProvider,
    private readonly whatsapp: WhatsAppNotificationProvider,
    private readonly twilio: TwilioNotificationProvider,
    private readonly secrets: SecretsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async find(actor: AuthenticatedUser, phone: string): Promise<WhatsAppCheck> {
    const [row] = await this.db
      .select()
      .from(whatsAppChecks)
      .where(and(eq(whatsAppChecks.clinicId, actor.clinicId), eq(whatsAppChecks.phone, phone)))
      .limit(1);

    return toWhatsAppCheck(row, phone, new Date());
  }

  async check(actor: AuthenticatedUser, phone: string): Promise<WhatsAppCheck> {
    if (!isMobilePhone(phone)) {
      throw new BadRequestException(WHATSAPP_CHECK_ERROR.NOT_MOBILE);
    }

    const route = await this.route(actor.clinicId);

    if (route === null) {
      throw new ConflictException(WHATSAPP_CHECK_ERROR.UNAVAILABLE);
    }

    const now = new Date();
    const code = String(randomInt(0, 10_000)).padStart(4, "0");

    const claim = await this.db.transaction(async (tx) => {
      await tx
        .insert(whatsAppChecks)
        .values({ clinicId: actor.clinicId, phone })
        .onConflictDoNothing();

      const [row] = await tx
        .select()
        .from(whatsAppChecks)
        .where(and(eq(whatsAppChecks.clinicId, actor.clinicId), eq(whatsAppChecks.phone, phone)))
        .for("update");

      if (!row || !shouldSendCheck(row, now)) {
        return { row, sent: false };
      }

      const [claimed] = await tx
        .update(whatsAppChecks)
        .set({
          status: WHATSAPP_STATUS.UNKNOWN,
          source: WHATSAPP_STATUS_SOURCE.OTP,
          providerMessageId: null,
          codeHash: hashCode(code),
          codeExpiresAt: new Date(now.getTime() + WHATSAPP_CODE_TTL_MS),
          sentAt: now,
          updatedAt: now,
        })
        .where(eq(whatsAppChecks.id, row.id))
        .returning();

      return { row: claimed, sent: true };
    });

    if (!claim.sent || !claim.row) {
      return toWhatsAppCheck(claim.row, phone, now);
    }

    const { id } = claim.row;

    try {
      if (route === "log") {
        await this.provider.send({
          to: phone,
          channel: NOTIFICATION_CHANNEL.WHATSAPP,
          body: `WhatsApp check code ${code}`,
        });

        return toWhatsAppCheck(claim.row, phone, now);
      }

      const providerMessageId =
        route === "twilio"
          ? await this.twilio.sendCode(phone, code)
          : await this.whatsapp.sendCodeWith(route, phone, code);
      const [row] = await this.db
        .update(whatsAppChecks)
        .set({ providerMessageId, updatedAt: new Date() })
        .where(eq(whatsAppChecks.id, id))
        .returning();

      return toWhatsAppCheck(row, phone, now);
    } catch (error) {
      this.logger.warn(
        `WhatsApp check to ${phone} failed: ${error instanceof Error ? error.message : String(error)}`,
      );

      const [row] = await this.db
        .update(whatsAppChecks)
        .set({ status: WHATSAPP_STATUS.ERROR, checkedAt: new Date(), updatedAt: new Date() })
        .where(eq(whatsAppChecks.id, id))
        .returning();

      return toWhatsAppCheck(row, phone, now);
    }
  }

  async applyDeliveries(payload: unknown): Promise<void> {
    for (const delivery of deliveryStatuses(payload)) {
      await this.apply(delivery.id, whatsAppStatusOf(delivery));
    }
  }

  async applyTwilioDelivery(delivery: TwilioStatus): Promise<void> {
    await this.apply(delivery.sid, whatsAppStatusOfTwilio(delivery));
  }

  private async apply(providerMessageId: string, status: WhatsAppStatus | null): Promise<void> {
    if (status === null) {
      return;
    }

    const conditions: SQL[] = [eq(whatsAppChecks.providerMessageId, providerMessageId)];

    if (status !== WHATSAPP_STATUS.AVAILABLE) {
      conditions.push(ne(whatsAppChecks.status, WHATSAPP_STATUS.AVAILABLE));
    }

    const now = new Date();

    await this.db
      .update(whatsAppChecks)
      .set({ status, checkedAt: now, updatedAt: now })
      .where(and(...conditions));
  }

  private async route(clinicId: string): Promise<WhatsAppCredentials | "twilio" | "log" | null> {
    if (this.config.get("NODE_ENV", { infer: true }) !== "test") {
      const credentials =
        (await this.secrets.whatsApp(clinicId)) ?? whatsAppCredentials(this.config);

      if (credentials) {
        return credentials;
      }

      if (this.provider.name === "twilio") {
        return "twilio";
      }
    }

    return this.provider.name === "log" ? "log" : null;
  }
}
