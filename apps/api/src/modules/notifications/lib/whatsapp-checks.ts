import { createHmac, timingSafeEqual } from "node:crypto";
import { WHATSAPP_STATUS, type WhatsAppCheck, type WhatsAppStatus } from "@clinic/shared";
import { z } from "zod";
import { type whatsAppChecks } from "@api/database/schema";
import {
  WHATSAPP_AWAIT_DELIVERY_MS,
  WHATSAPP_CHECK_FRESH_MS,
  WHATSAPP_RESEND_AFTER_MS,
  WHATSAPP_UNDELIVERABLE,
} from "@api/modules/notifications/constants";

export type WhatsAppCheckRow = typeof whatsAppChecks.$inferSelect;

export const deliveryStatusSchema = z.object({
  id: z.string(),
  status: z.string(),
  errors: z.array(z.object({ code: z.number() }).passthrough()).optional(),
});

export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;

export const webhookPayloadSchema = z.object({
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              value: z.object({ statuses: z.array(deliveryStatusSchema).optional() }).passthrough(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

export const deliveryStatuses = (payload: unknown): DeliveryStatus[] => {
  const parsed = webhookPayloadSchema.safeParse(payload);

  return parsed.success
    ? parsed.data.entry.flatMap((entry) =>
        entry.changes.flatMap((change) => change.value.statuses ?? []),
      )
    : [];
};

export function whatsAppStatusOf(delivery: DeliveryStatus): WhatsAppStatus | null {
  if (["sent", "delivered", "read"].includes(delivery.status)) {
    return WHATSAPP_STATUS.AVAILABLE;
  }

  if (delivery.status !== "failed") {
    return null;
  }

  return delivery.errors?.some((error) => error.code === WHATSAPP_UNDELIVERABLE)
    ? WHATSAPP_STATUS.UNAVAILABLE
    : WHATSAPP_STATUS.ERROR;
}

const isSettled = (status: WhatsAppStatus): boolean =>
  status === WHATSAPP_STATUS.AVAILABLE || status === WHATSAPP_STATUS.UNAVAILABLE;

export function shouldSendCheck(row: WhatsAppCheckRow, now: Date): boolean {
  if (row.sentAt === null) {
    return true;
  }

  if (isSettled(row.status)) {
    return (
      row.checkedAt === null || now.getTime() - row.checkedAt.getTime() >= WHATSAPP_CHECK_FRESH_MS
    );
  }

  return now.getTime() - row.sentAt.getTime() >= WHATSAPP_RESEND_AFTER_MS;
}

export const toWhatsAppCheck = (
  row: WhatsAppCheckRow | undefined,
  phone: string,
  now: Date,
): WhatsAppCheck => ({
  phone,
  status: row?.status ?? WHATSAPP_STATUS.UNKNOWN,
  checking:
    row?.status === WHATSAPP_STATUS.UNKNOWN &&
    row.sentAt !== null &&
    now.getTime() - row.sentAt.getTime() < WHATSAPP_AWAIT_DELIVERY_MS,
  checkedAt: row?.checkedAt?.toISOString() ?? null,
});

export function isSignedBy(secret: string, body: Buffer, signature: string | undefined): boolean {
  if (!signature?.startsWith("sha256=")) {
    return false;
  }

  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"));
  const given = Buffer.from(signature.slice("sha256=".length));

  return expected.length === given.length && timingSafeEqual(expected, given);
}
