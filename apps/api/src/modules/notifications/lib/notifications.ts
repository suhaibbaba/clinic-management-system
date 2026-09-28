import {
  type NotificationTemplate,
  type NotificationChannel,
  NOTIFICATION_STATUS,
} from "@clinic/shared";

export interface SendNotification {
  readonly clinicId: string;
  readonly to: string;
  readonly template: NotificationTemplate;
  readonly vars: Record<string, string>;
  readonly channel?: NotificationChannel | undefined;
  readonly appointmentId?: string | undefined;
}

export interface SendResult {
  readonly id: string;
  readonly status: (typeof NOTIFICATION_STATUS)[keyof typeof NOTIFICATION_STATUS];
  readonly body: string;
}
