import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_STATUS,
  notificationSettings,
  renderTemplate,
  type NotificationChannel,
  type NotificationSettings,
  type NotificationTemplate,
} from "@clinic/shared";
import { and, eq } from "drizzle-orm";
import { type Env } from "@api/config/env.schema";
import { DATABASE, type Database } from "@api/database/database.module";
import { clinics, notificationsLog } from "@api/database/schema";
import { afterCommit, inRehearsal } from "@api/database/unit-of-work";
import { NOTIFICATION_PROVIDER } from "@api/modules/notifications/constants";
import { WhatsAppNotificationProvider } from "@api/modules/notifications/services/notification-provider";
import {
  type NotificationProvider,
  type OutboundMessage,
} from "@api/modules/notifications/lib/notification-provider";
import { SecretsService } from "@api/modules/secrets/services/secrets.service";
import { SendNotification, SendResult } from "@api/modules/notifications/lib/notifications";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(NOTIFICATION_PROVIDER) private readonly provider: NotificationProvider,
    private readonly whatsapp: WhatsAppNotificationProvider,
    private readonly secrets: SecretsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async send(input: SendNotification): Promise<SendResult | null> {
    const settings = await this.settingsFor(input.clinicId);

    if (!settings.enabled || inRehearsal()) {
      return null;
    }

    const channel = input.channel ?? settings.channel;
    const body = renderTemplate(this.bodyFor(settings, input.template), input.vars);

    const [row] = await this.db
      .insert(notificationsLog)
      .values({
        clinicId: input.clinicId,
        to: input.to,
        channel,
        template: input.template,
        vars: input.vars,
        status: NOTIFICATION_STATUS.QUEUED,
        appointmentId: input.appointmentId ?? null,
      })
      .returning({ id: notificationsLog.id });

    if (!row) {
      throw new Error("Failed to record the notification");
    }

    let result: SendResult = { id: row.id, status: NOTIFICATION_STATUS.QUEUED, body };

    await afterCommit(async () => {
      result = await this.dispatch(row.id, input, channel, body);
    });

    return result;
  }

  private async dispatch(
    id: string,
    input: SendNotification,
    channel: NotificationChannel,
    body: string,
  ): Promise<SendResult> {
    try {
      await this.deliver(input.clinicId, { to: input.to, channel, body });

      await this.db
        .update(notificationsLog)
        .set({ status: NOTIFICATION_STATUS.SENT })
        .where(eq(notificationsLog.id, id));

      return { id, status: NOTIFICATION_STATUS.SENT, body };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Notification ${input.template} to ${input.to} failed: ${message}`);

      await this.db
        .update(notificationsLog)
        .set({ status: NOTIFICATION_STATUS.FAILED, error: message.slice(0, 500) })
        .where(eq(notificationsLog.id, id));

      return { id, status: NOTIFICATION_STATUS.FAILED, body };
    }
  }

  private async deliver(clinicId: string, message: OutboundMessage): Promise<void> {
    if (
      message.channel === NOTIFICATION_CHANNEL.WHATSAPP &&
      this.config.get("NODE_ENV", { infer: true }) !== "test"
    ) {
      const own = await this.secrets.whatsApp(clinicId);

      if (own) {
        return this.whatsapp.sendWith(own, message);
      }
    }

    return this.provider.send(message);
  }

  async alreadySent(appointmentId: string, template: NotificationTemplate): Promise<boolean> {
    const [row] = await this.db
      .select({ id: notificationsLog.id })
      .from(notificationsLog)
      .where(
        and(
          eq(notificationsLog.appointmentId, appointmentId),
          eq(notificationsLog.template, template),
        ),
      )
      .limit(1);

    return row !== undefined;
  }

  async settingsFor(clinicId: string): Promise<NotificationSettings> {
    const [row] = await this.db
      .select({ settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    return notificationSettings(row?.settings);
  }

  private bodyFor(settings: NotificationSettings, template: NotificationTemplate): string {
    const custom = settings.templates[template];

    return typeof custom === "string" && custom.trim() !== ""
      ? custom
      : DEFAULT_NOTIFICATION_TEMPLATES[template];
  }
}
