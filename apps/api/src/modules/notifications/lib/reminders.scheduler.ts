import { type NotificationTemplate } from "@clinic/shared";

export interface Reminder {
  readonly template: NotificationTemplate;
  readonly leadMs: number;
  readonly setting: "remind24h" | "remind2h";
}
