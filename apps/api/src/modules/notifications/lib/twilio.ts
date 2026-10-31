import { createHmac, timingSafeEqual } from "node:crypto";
import { WHATSAPP_STATUS, type WhatsAppStatus } from "@clinic/shared";
import { ConfigService } from "@nestjs/config";
import { type Env } from "@api/config/env.schema";
import { TWILIO_UNDELIVERABLE } from "@api/modules/notifications/constants";

export interface TwilioCredentials {
  readonly accountSid: string;
  readonly authToken: string;
  readonly from: string;
  readonly templateSid: string | null;
  readonly documentTemplateSid: string | null;
  readonly codeTemplateSid: string | null;
  readonly statusCallbackUrl: string | null;
}

export interface TwilioStatus {
  readonly sid: string;
  readonly status: string;
  readonly errorCode: number | null;
}

export function twilioCredentials(config: ConfigService<Env, true>): TwilioCredentials | null {
  const accountSid = config.get("TWILIO_ACCOUNT_SID", { infer: true });
  const authToken = config.get("TWILIO_AUTH_TOKEN", { infer: true });
  const from = config.get("TWILIO_WHATSAPP_FROM", { infer: true });

  return accountSid && authToken && from
    ? {
        accountSid,
        authToken,
        from,
        templateSid: config.get("TWILIO_TEMPLATE_SID", { infer: true }) ?? null,
        documentTemplateSid: config.get("TWILIO_DOCUMENT_TEMPLATE_SID", { infer: true }) ?? null,
        codeTemplateSid: config.get("TWILIO_CODE_TEMPLATE_SID", { infer: true }) ?? null,
        statusCallbackUrl: config.get("TWILIO_STATUS_CALLBACK_URL", { infer: true }) ?? null,
      }
    : null;
}

export const twilioAddress = (phone: string): string => `whatsapp:+${phone.replace(/\D/g, "")}`;

export const mediaPathOf = (url: string): string => {
  const parsed = new URL(url);

  return `${parsed.pathname.slice(1)}${parsed.search}`;
};

export function isTwilioSigned(
  authToken: string,
  url: string,
  params: URLSearchParams,
  signature: string | undefined,
): boolean {
  if (!signature) {
    return false;
  }

  const payload = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .reduce((joined, [key, value]) => `${joined}${key}${value}`, url);
  const expected = Buffer.from(createHmac("sha1", authToken).update(payload).digest("base64"));
  const given = Buffer.from(signature);

  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function twilioStatusFrom(params: URLSearchParams): TwilioStatus | null {
  const sid = params.get("MessageSid");
  const status = params.get("MessageStatus");
  const errorCode = Number(params.get("ErrorCode"));

  return sid && status
    ? { sid, status, errorCode: Number.isInteger(errorCode) && errorCode > 0 ? errorCode : null }
    : null;
}

export function whatsAppStatusOfTwilio(delivery: TwilioStatus): WhatsAppStatus | null {
  if (["sent", "delivered", "read"].includes(delivery.status)) {
    return WHATSAPP_STATUS.AVAILABLE;
  }

  if (delivery.status !== "failed" && delivery.status !== "undelivered") {
    return null;
  }

  return delivery.errorCode !== null && TWILIO_UNDELIVERABLE.includes(delivery.errorCode)
    ? WHATSAPP_STATUS.UNAVAILABLE
    : WHATSAPP_STATUS.ERROR;
}
