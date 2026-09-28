import { type NotificationChannel } from "@clinic/shared";
import { ConfigService } from "@nestjs/config";
import { type Env } from "@api/config/env.schema";
import { WHATSAPP_PARAMETER_LIMIT } from "@api/notifications/constants";

export interface OutboundMessage {
  readonly to: string;
  readonly channel: NotificationChannel;
  readonly body: string;
}

export interface NotificationProvider {
  readonly name: string;
  send(message: OutboundMessage): Promise<void>;
}

export interface WhatsAppCredentials {
  readonly accessToken: string;
  readonly phoneNumberId: string;
  readonly templateName: string;
}

export function whatsAppCredentials(config: ConfigService<Env, true>): WhatsAppCredentials | null {
  const accessToken = config.get("WHATSAPP_ACCESS_TOKEN", { infer: true });
  const phoneNumberId = config.get("WHATSAPP_PHONE_NUMBER_ID", { infer: true });
  const templateName = config.get("WHATSAPP_TEMPLATE_NAME", { infer: true });

  return accessToken && phoneNumberId && templateName
    ? { accessToken, phoneNumberId, templateName }
    : null;
}

export function toWhatsAppParameter(body: string): string {
  return body
    .replace(/\s*[\r\n\t]+\s*/g, " ")
    .replace(/ {4,}/g, "   ")
    .trim()
    .slice(0, WHATSAPP_PARAMETER_LIMIT);
}
