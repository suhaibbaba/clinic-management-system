import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NotificationChannel } from "@clinic/shared";
import type { Env } from "@api/config/env.schema";

export interface OutboundMessage {
  readonly to: string;
  readonly channel: NotificationChannel;
  readonly body: string;
}

export interface NotificationProvider {
  readonly name: string;
  send(message: OutboundMessage): Promise<void>;
}

export const NOTIFICATION_PROVIDER = Symbol("NOTIFICATION_PROVIDER");

@Injectable()
export class LogNotificationProvider implements NotificationProvider {
  readonly name = "log";

  private readonly logger = new Logger("Notifications");

  send(message: OutboundMessage): Promise<void> {
    this.logger.log(`[${message.channel}] → ${message.to}: ${message.body}`);

    return Promise.resolve();
  }
}

@Injectable()
export class HttpNotificationProvider implements NotificationProvider {
  readonly name = "http";

  private readonly logger = new Logger("Notifications");

  constructor(private readonly config: ConfigService<Env, true>) {}

  async send(message: OutboundMessage): Promise<void> {
    const url = this.config.get("NOTIFICATIONS_HTTP_URL", { infer: true });

    if (!url) {
      throw new Error("NOTIFICATIONS_HTTP_URL is not configured");
    }

    const token = this.config.get("NOTIFICATIONS_HTTP_TOKEN", { infer: true });
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.get("NOTIFICATIONS_HTTP_TIMEOUT_MS", { infer: true }),
    );

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          to: message.to,
          channel: message.channel,
          body: message.body,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Gateway responded ${response.status}: ${detail.slice(0, 200)}`);
      }
    } finally {
      clearTimeout(timeout);
      this.logger.debug(`Delivered to ${message.to} over ${message.channel}`);
    }
  }
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

const WHATSAPP_PARAMETER_LIMIT = 1000;

export function toWhatsAppParameter(body: string): string {
  return body
    .replace(/\s*[\r\n\t]+\s*/g, " ")
    .replace(/ {4,}/g, "   ")
    .trim()
    .slice(0, WHATSAPP_PARAMETER_LIMIT);
}

@Injectable()
export class WhatsAppNotificationProvider implements NotificationProvider {
  readonly name = "whatsapp";

  private readonly logger = new Logger("Notifications");

  constructor(private readonly config: ConfigService<Env, true>) {}

  send(message: OutboundMessage): Promise<void> {
    const credentials = whatsAppCredentials(this.config);

    if (!credentials) {
      return Promise.reject(new Error("WhatsApp is not configured"));
    }

    return this.sendWith(credentials, message);
  }

  async sendWith(credentials: WhatsAppCredentials, message: OutboundMessage): Promise<void> {
    if (!message.to.trim().startsWith("+")) {
      throw new Error("The number is not in international form");
    }

    const version = this.config.get("WHATSAPP_API_VERSION", { infer: true });
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.get("NOTIFICATIONS_HTTP_TIMEOUT_MS", { infer: true }),
    );

    try {
      const response = await fetch(
        `https://graph.facebook.com/${version}/${encodeURIComponent(credentials.phoneNumberId)}/messages`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${credentials.accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: message.to.replace(/\D/g, ""),
            type: "template",
            template: {
              name: credentials.templateName,
              language: { code: this.config.get("WHATSAPP_TEMPLATE_LANGUAGE", { infer: true }) },
              components: [
                {
                  type: "body",
                  parameters: [{ type: "text", text: toWhatsAppParameter(message.body) }],
                },
              ],
            },
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`WhatsApp responded ${response.status}: ${detail.slice(0, 200)}`);
      }
    } finally {
      clearTimeout(timeout);
      this.logger.debug(`Delivered to ${message.to} over WhatsApp`);
    }
  }
}
