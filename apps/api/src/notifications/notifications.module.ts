import { Module } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { AppConfigModule } from '@api/config/config.module';
import type { Env } from '@api/config/env.schema';
import { DatabaseModule } from '@api/database/database.module';
import {
  HttpNotificationProvider,
  LogNotificationProvider,
  NOTIFICATION_PROVIDER,
  type NotificationProvider,
} from '@api/notifications/notification-provider';
import { NotificationsService } from '@api/notifications/notifications.service';
import { RemindersScheduler } from '@api/notifications/reminders.scheduler';

@Module({
  imports: [DatabaseModule, AppConfigModule],
  providers: [
    LogNotificationProvider,
    HttpNotificationProvider,
    {
      provide: NOTIFICATION_PROVIDER,
      inject: [ConfigService, LogNotificationProvider, HttpNotificationProvider],
      useFactory: (
        config: ConfigService<Env, true>,
        log: LogNotificationProvider,
        http: HttpNotificationProvider,
      ): NotificationProvider =>
        config.get('NOTIFICATIONS_PROVIDER', { infer: true }) === 'http' ? http : log,
    },
    NotificationsService,
    RemindersScheduler,
  ],
  exports: [NotificationsService, RemindersScheduler],
})
export class NotificationsModule {}
