import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NotificationChannel } from '@clinic/shared';

import type { Env } from '@api/config/env.schema';

export interface OutboundMessage {
  readonly to: string;
  readonly channel: NotificationChannel;
  readonly body: string;
}

// One method, because that is all a WhatsApp API and an SMS gateway have in common. A provider
// throws to fail; the service turns that into a `failed` row.
export interface NotificationProvider {
  readonly name: string;
  send(message: OutboundMessage): Promise<void>;
}

export const NOTIFICATION_PROVIDER = Symbol('NOTIFICATION_PROVIDER');

// Not a stub: it is the correct provider wherever there is no gateway, and the message still
// reaches `notifications_log`, so the OTP flow works end to end.
@Injectable()
export class LogNotificationProvider implements NotificationProvider {
  readonly name = 'log';

  private readonly logger = new Logger('Notifications');

  send(message: OutboundMessage): Promise<void> {
    this.logger.log(`[${message.channel}] → ${message.to}: ${message.body}`);

    return Promise.resolve();
  }
}

// `{ to, channel, body }` is the shape a local SMS gateway takes and a thin WhatsApp adapter would
// expose. The timeout is not optional — a gateway that never answers would hold a booking open.
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
