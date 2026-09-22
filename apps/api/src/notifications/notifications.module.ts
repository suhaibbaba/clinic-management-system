import { Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppConfigModule } from "@api/config/config.module";
import type { Env } from "@api/config/env.schema";
import { DatabaseModule } from "@api/database/database.module";
import {
  HttpNotificationProvider,
  LogNotificationProvider,
  NOTIFICATION_PROVIDER,
  WhatsAppNotificationProvider,
  whatsAppCredentials,
  type NotificationProvider,
} from "@api/notifications/notification-provider";
import { NotificationsService } from "@api/notifications/notifications.service";
import { RemindersScheduler } from "@api/notifications/reminders.scheduler";
import { SecretsModule } from "@api/secrets/secrets.module";

@Module({
  imports: [DatabaseModule, AppConfigModule, SecretsModule],
  providers: [
    LogNotificationProvider,
    HttpNotificationProvider,
    WhatsAppNotificationProvider,
    {
      provide: NOTIFICATION_PROVIDER,
      inject: [
        ConfigService,
        LogNotificationProvider,
        HttpNotificationProvider,
        WhatsAppNotificationProvider,
      ],
      useFactory: (
        config: ConfigService<Env, true>,
        log: LogNotificationProvider,
        http: HttpNotificationProvider,
        whatsapp: WhatsAppNotificationProvider,
      ): NotificationProvider => {
        const chosen = config.get("NOTIFICATIONS_PROVIDER", { infer: true });
        const logger = new Logger("Notifications");

        // Tests reach real patients' numbers through fixtures, so no test run ever leaves `log`.
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

        return chosen === "http" ? http : log;
      },
    },
    NotificationsService,
    RemindersScheduler,
  ],
  exports: [NotificationsService, RemindersScheduler],
})
export class NotificationsModule {}
