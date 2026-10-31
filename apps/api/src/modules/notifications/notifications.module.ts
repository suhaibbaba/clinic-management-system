import { Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppConfigModule } from "@api/config/config.module";
import type { Env } from "@api/config/env.schema";
import { DatabaseModule } from "@api/database/database.module";
import {
  HttpNotificationProvider,
  LogNotificationProvider,
  TwilioNotificationProvider,
  WhatsAppNotificationProvider,
} from "@api/modules/notifications/services/notification-provider";
import { NOTIFICATION_PROVIDER } from "@api/modules/notifications/constants";
import {
  whatsAppCredentials,
  type NotificationProvider,
} from "@api/modules/notifications/lib/notification-provider";
import { NotificationsService } from "@api/modules/notifications/services/notifications.service";
import { DocumentDeliveryController } from "@api/modules/notifications/controllers/document-delivery.controller";
import { DocumentDeliveryService } from "@api/modules/notifications/services/document-delivery.service";
import { RemindersScheduler } from "@api/modules/notifications/services/reminders.scheduler";
import { SecretsModule } from "@api/modules/secrets/secrets.module";
import { WhatsAppChecksController } from "@api/modules/notifications/controllers/whatsapp-checks.controller";
import { WhatsAppWebhookController } from "@api/modules/notifications/controllers/whatsapp-webhook.controller";
import { TwilioWebhookController } from "@api/modules/notifications/controllers/twilio-webhook.controller";
import { twilioCredentials } from "@api/modules/notifications/lib/twilio";
import { WhatsAppChecksService } from "@api/modules/notifications/services/whatsapp-checks.service";

@Module({
  imports: [DatabaseModule, AppConfigModule, SecretsModule],
  controllers: [
    DocumentDeliveryController,
    WhatsAppChecksController,
    WhatsAppWebhookController,
    TwilioWebhookController,
  ],
  providers: [
    LogNotificationProvider,
    HttpNotificationProvider,
    WhatsAppNotificationProvider,
    TwilioNotificationProvider,
    {
      provide: NOTIFICATION_PROVIDER,
      inject: [
        ConfigService,
        LogNotificationProvider,
        HttpNotificationProvider,
        WhatsAppNotificationProvider,
        TwilioNotificationProvider,
      ],
      useFactory: (
        config: ConfigService<Env, true>,
        log: LogNotificationProvider,
        http: HttpNotificationProvider,
        whatsapp: WhatsAppNotificationProvider,
        twilio: TwilioNotificationProvider,
      ): NotificationProvider => {
        const chosen = config.get("NOTIFICATIONS_PROVIDER", { infer: true });
        const logger = new Logger("Notifications");

        if (config.get("NODE_ENV", { infer: true }) === "test") {
          return log;
        }

        if (chosen === "whatsapp") {
          if (whatsAppCredentials(config)) {
            logger.log("Notification provider: whatsapp.");

            return whatsapp;
          }

          logger.warn(
            "NOTIFICATIONS_PROVIDER=whatsapp but a WHATSAPP_* credential is missing — using log; nothing is sent.",
          );

          return log;
        }

        if (chosen === "twilio") {
          if (twilioCredentials(config)) {
            logger.log("Notification provider: twilio.");

            return twilio;
          }

          logger.warn(
            "NOTIFICATIONS_PROVIDER=twilio but a TWILIO_* credential is missing — using log; nothing is sent.",
          );

          return log;
        }

        return chosen === "http" ? http : log;
      },
    },
    NotificationsService,
    DocumentDeliveryService,
    RemindersScheduler,
    WhatsAppChecksService,
  ],
  exports: [NotificationsService, DocumentDeliveryService, RemindersScheduler],
})
export class NotificationsModule {}
