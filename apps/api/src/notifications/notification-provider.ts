import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NotificationChannel } from '@clinic/shared';

import type { Env } from '@api/config/env.schema';

/** One outbound message, already rendered. */
export interface OutboundMessage {
  readonly to: string;
  readonly channel: NotificationChannel;
  readonly body: string;
}

/**
 * How a message leaves the building.
 *
 * The whole abstraction is one method, because that is the whole of what a
 * WhatsApp API and a local SMS gateway have in common — everything else about
 * them is configuration. A provider **throws** to fail; the service turns that
 * into a `failed` row rather than letting it reach the caller, so a dead
 * gateway never breaks a booking.
 */
export interface NotificationProvider {
  readonly name: string;
  send(message: OutboundMessage): Promise<void>;
}

export const NOTIFICATION_PROVIDER = Symbol('NOTIFICATION_PROVIDER');

/**
 * The sandbox default: writes the message down and sends nothing.
 *
 * Not a stub to be replaced before the module is useful — it is the correct
 * provider for every environment that has no gateway, which is all of them
 * today. The message still reaches `notifications_log`, so the OTP flow, the
 * reminder scheduler and their tests all work end to end with no credentials.
 */
@Injectable()
export class LogNotificationProvider implements NotificationProvider {
  readonly name = 'log';

  private readonly logger = new Logger('Notifications');

  send(message: OutboundMessage): Promise<void> {
    this.logger.log(`[${message.channel}] → ${message.to}: ${message.body}`);

    return Promise.resolve();
  }
}

/**
 * Posts the message to one URL.
 *
 * Deliberately generic: `{ to, channel, body }` as JSON with an optional bearer
 * token is the shape every local SMS gateway already accepts and the shape a
 * thin adapter in front of the WhatsApp Business API would expose. Integrating
 * a named provider is a later PR; this is the seam it will slot into.
 *
 * The timeout is not optional. A gateway that accepts a connection and never
 * answers would otherwise hold a booking request open until the client gives
 * up, and the patient would see a failure for a booking that was made.
 */
@Injectable()
export class HttpNotificationProvider implements NotificationProvider {
  readonly name = 'http';

  private readonly logger = new Logger('Notifications');

  constructor(private readonly config: ConfigService<Env, true>) {}

  async send(message: OutboundMessage): Promise<void> {
    const url = this.config.get('NOTIFICATIONS_HTTP_URL', { infer: true });

    if (!url) {
      throw new Error('NOTIFICATIONS_HTTP_URL is not configured');
    }

    const token = this.config.get('NOTIFICATIONS_HTTP_TOKEN', { infer: true });
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.get('NOTIFICATIONS_HTTP_TIMEOUT_MS', { infer: true }),
    );

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
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
        // The body is read for the log, not for the caller: a gateway's error
        // text is diagnostic and must never reach a patient's screen.
        const detail = await response.text().catch(() => '');
        throw new Error(`Gateway responded ${response.status}: ${detail.slice(0, 200)}`);
      }
    } finally {
      clearTimeout(timeout);
      this.logger.debug(`Delivered to ${message.to} over ${message.channel}`);
    }
  }
}
