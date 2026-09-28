import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type Env } from "@api/config/env.schema";
import {
  NotificationProvider,
  OutboundMessage,
  whatsAppCredentials,
  toWhatsAppParameter,
} from "@api/modules/notifications/lib/notification-provider";
import { WhatsAppCredentials } from "@api/common/types/whatsapp";

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
