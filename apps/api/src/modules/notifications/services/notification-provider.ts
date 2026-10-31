import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type Env } from "@api/config/env.schema";
import {
  NotificationProvider,
  OutboundDocument,
  OutboundMessage,
  whatsAppCredentials,
  toWhatsAppParameter,
} from "@api/modules/notifications/lib/notification-provider";
import { WhatsAppCredentials } from "@api/common/types/whatsapp";
import { TWILIO_API } from "@api/modules/notifications/constants";
import {
  mediaPathOf,
  twilioAddress,
  twilioCredentials,
  type TwilioCredentials,
} from "@api/modules/notifications/lib/twilio";

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

  async sendDocumentWith(
    credentials: WhatsAppCredentials,
    document: OutboundDocument,
  ): Promise<void> {
    if (!credentials.documentTemplateName) {
      throw new Error("No WhatsApp template for documents");
    }

    if (!document.to.trim().startsWith("+")) {
      throw new Error("The number is not in international form");
    }

    const base = `https://graph.facebook.com/${this.config.get("WHATSAPP_API_VERSION", { infer: true })}/${encodeURIComponent(credentials.phoneNumberId)}`;
    const authorization = `Bearer ${credentials.accessToken}`;

    const upload = new FormData();
    upload.append("messaging_product", "whatsapp");
    upload.append("type", "application/pdf");
    upload.append(
      "file",
      new Blob([new Uint8Array(document.pdf)], { type: "application/pdf" }),
      document.filename,
    );

    const media = await this.call(`${base}/media`, { authorization }, upload);
    const mediaId = (media as { id?: unknown }).id;

    if (typeof mediaId !== "string") {
      throw new Error("WhatsApp returned no media id");
    }

    await this.call(
      `${base}/messages`,
      { authorization, "content-type": "application/json" },
      JSON.stringify({
        messaging_product: "whatsapp",
        to: document.to.replace(/\D/g, ""),
        type: "template",
        template: {
          name: credentials.documentTemplateName,
          language: { code: this.config.get("WHATSAPP_TEMPLATE_LANGUAGE", { infer: true }) },
          components: [
            {
              type: "header",
              parameters: [
                { type: "document", document: { id: mediaId, filename: document.filename } },
              ],
            },
            {
              type: "body",
              parameters: [{ type: "text", text: toWhatsAppParameter(document.caption) }],
            },
          ],
        },
      }),
    );

    this.logger.debug(`Delivered a document to ${document.to} over WhatsApp`);
  }

  async sendCodeWith(credentials: WhatsAppCredentials, to: string, code: string): Promise<string> {
    const base = `https://graph.facebook.com/${this.config.get("WHATSAPP_API_VERSION", { infer: true })}/${encodeURIComponent(credentials.phoneNumberId)}`;
    const sent = await this.call(
      `${base}/messages`,
      { authorization: `Bearer ${credentials.accessToken}`, "content-type": "application/json" },
      JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/\D/g, ""),
        type: "template",
        template: {
          name: this.config.get("WHATSAPP_CODE_TEMPLATE_NAME", { infer: true }),
          language: { code: this.config.get("WHATSAPP_TEMPLATE_LANGUAGE", { infer: true }) },
          components: [
            { type: "body", parameters: [{ type: "text", text: code }] },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: code }],
            },
          ],
        },
      }),
    );
    const messageId = (sent as { messages?: { id?: unknown }[] }).messages?.[0]?.id;

    if (typeof messageId !== "string") {
      throw new Error("WhatsApp returned no message id");
    }

    return messageId;
  }

  private async call(
    url: string,
    headers: Record<string, string>,
    body: FormData | string,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.get("NOTIFICATIONS_HTTP_TIMEOUT_MS", { infer: true }),
    );

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`WhatsApp responded ${response.status}: ${detail.slice(0, 200)}`);
      }

      return (await response.json()) as unknown;
    } finally {
      clearTimeout(timeout);
    }
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

@Injectable()
export class TwilioNotificationProvider implements NotificationProvider {
  readonly name = "twilio";

  private readonly logger = new Logger("Notifications");

  constructor(private readonly config: ConfigService<Env, true>) {}

  credentials(): TwilioCredentials | null {
    return twilioCredentials(this.config);
  }

  async send(message: OutboundMessage): Promise<void> {
    const credentials = this.required();
    const text = toWhatsAppParameter(message.body);

    await this.create(
      credentials,
      message.to,
      credentials.templateSid
        ? { ContentSid: credentials.templateSid, ContentVariables: JSON.stringify({ 1: text }) }
        : { Body: text },
    );

    this.logger.debug(`Delivered to ${message.to} over Twilio WhatsApp`);
  }

  sendCode(to: string, code: string): Promise<string> {
    const credentials = this.required();

    return this.create(
      credentials,
      to,
      credentials.codeTemplateSid
        ? { ContentSid: credentials.codeTemplateSid, ContentVariables: JSON.stringify({ 1: code }) }
        : { Body: code },
    );
  }

  async sendDocument(to: string, mediaUrl: string, caption: string): Promise<void> {
    const credentials = this.required();
    const text = toWhatsAppParameter(caption);

    await this.create(
      credentials,
      to,
      credentials.documentTemplateSid
        ? {
            ContentSid: credentials.documentTemplateSid,
            ContentVariables: JSON.stringify({ 1: text, 2: mediaPathOf(mediaUrl) }),
          }
        : { Body: text, MediaUrl: mediaUrl },
    );

    this.logger.debug(`Delivered a document to ${to} over Twilio WhatsApp`);
  }

  private required(): TwilioCredentials {
    const credentials = this.credentials();

    if (!credentials) {
      throw new Error("Twilio is not configured");
    }

    return credentials;
  }

  private async create(
    credentials: TwilioCredentials,
    to: string,
    content: Record<string, string>,
  ): Promise<string> {
    if (!to.trim().startsWith("+")) {
      throw new Error("The number is not in international form");
    }

    const form = new URLSearchParams({
      From: twilioAddress(credentials.from),
      To: twilioAddress(to),
      ...content,
      ...(credentials.statusCallbackUrl ? { StatusCallback: credentials.statusCallbackUrl } : {}),
    });
    const basic = Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString(
      "base64",
    );
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.get("NOTIFICATIONS_HTTP_TIMEOUT_MS", { infer: true }),
    );

    try {
      const response = await fetch(
        `${TWILIO_API}/Accounts/${encodeURIComponent(credentials.accountSid)}/Messages.json`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            authorization: `Basic ${basic}`,
          },
          body: form.toString(),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Twilio responded ${response.status}: ${detail.slice(0, 200)}`);
      }

      const sid = ((await response.json()) as { sid?: unknown }).sid;

      if (typeof sid !== "string") {
        throw new Error("Twilio returned no message sid");
      }

      return sid;
    } finally {
      clearTimeout(timeout);
    }
  }
}
