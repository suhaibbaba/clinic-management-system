import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  NOTIFICATION_STATUS,
  notificationSettings,
  renderTemplate,
  type NotificationChannel,
  type NotificationSettings,
  type NotificationTemplate,
} from '@clinic/shared';
import { and, eq } from 'drizzle-orm';

import { DATABASE, type Database } from '@api/database/database.module';
import { clinics, notificationsLog } from '@api/database/schema';
import {
  NOTIFICATION_PROVIDER,
  type NotificationProvider,
} from '@api/notifications/notification-provider';

export interface SendNotification {
  readonly clinicId: string;
  /** Destination phone number, as dialled. */
  readonly to: string;
  readonly template: NotificationTemplate;
  readonly vars: Record<string, string>;
  /** Overrides the clinic's configured channel; used by nothing yet. */
  readonly channel?: NotificationChannel | undefined;
  /** The appointment it is about, when it is about one — the dedupe key. */
  readonly appointmentId?: string | undefined;
}

export interface SendResult {
  readonly id: string;
  readonly status: (typeof NOTIFICATION_STATUS)[keyof typeof NOTIFICATION_STATUS];
  /** The rendered body. Returned for tests and the log, never for a patient. */
  readonly body: string;
}

/**
 * Sending a message to a patient.
 *
 * Three things are deliberate.
 *
 * **The log row is written before the provider is called.** A provider that
 * throws, hangs or is killed mid-send still leaves a `queued` row behind — a
 * send that vanishes without a trace is the single failure a notification log
 * exists to prevent, and it is the one that looks like "we never told them".
 *
 * **A failure never reaches the caller.** `send` resolves whatever the gateway
 * does; the row records `failed` and the error. A booking must not fail because
 * an SMS gateway is down, and a reminder that cannot go out is not a reason to
 * crash a scheduled job partway through the list.
 *
 * **Templates come from the clinic, with a default underneath.** A clinic edits
 * its own wording in settings; anything it has not written falls back to the
 * Arabic defaults in `@clinic/shared`, so a fresh clinic sends sensible
 * messages before anyone configures it.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(NOTIFICATION_PROVIDER) private readonly provider: NotificationProvider,
  ) {}

  async send(input: SendNotification): Promise<SendResult | null> {
    const settings = await this.settingsFor(input.clinicId);

    if (!settings.enabled) {
      // The master switch is off. Not an error and not a row: a clinic that has
      // turned notifications off has not failed to send anything.
      return null;
    }

    const channel = input.channel ?? settings.channel;
    const body = renderTemplate(this.bodyFor(settings, input.template), input.vars);

    const [row] = await this.db
      .insert(notificationsLog)
      .values({
        clinicId: input.clinicId,
        to: input.to,
        channel,
        template: input.template,
        vars: input.vars,
        status: NOTIFICATION_STATUS.QUEUED,
        appointmentId: input.appointmentId ?? null,
      })
      .returning({ id: notificationsLog.id });

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!row) {
      throw new Error('Failed to record the notification');
    }

    try {
      await this.provider.send({ to: input.to, channel, body });

      await this.db
        .update(notificationsLog)
        .set({ status: NOTIFICATION_STATUS.SENT })
        .where(eq(notificationsLog.id, row.id));

      return { id: row.id, status: NOTIFICATION_STATUS.SENT, body };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Notification ${input.template} to ${input.to} failed: ${message}`);

      await this.db
        .update(notificationsLog)
        .set({ status: NOTIFICATION_STATUS.FAILED, error: message.slice(0, 500) })
        .where(eq(notificationsLog.id, row.id));

      return { id: row.id, status: NOTIFICATION_STATUS.FAILED, body };
    }
  }

  /**
   * Whether this exact message has already gone out for this appointment.
   *
   * The reminder scheduler's guard, and the reason there is no separate
   * "sent markers" table: the log already holds the fact, and a second table
   * holding it too could disagree. A `failed` row counts as sent for this
   * purpose — retrying a reminder every five minutes against a dead gateway
   * would fill the log and, once it recovered, deliver a pile of them at once.
   */
  async alreadySent(appointmentId: string, template: NotificationTemplate): Promise<boolean> {
    const [row] = await this.db
      .select({ id: notificationsLog.id })
      .from(notificationsLog)
      .where(
        and(
          eq(notificationsLog.appointmentId, appointmentId),
          eq(notificationsLog.template, template),
        ),
      )
      .limit(1);

    return row !== undefined;
  }

  async settingsFor(clinicId: string): Promise<NotificationSettings> {
    const [row] = await this.db
      .select({ settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    return notificationSettings(row?.settings);
  }

  private bodyFor(settings: NotificationSettings, template: NotificationTemplate): string {
    const custom = settings.templates[template];

    return typeof custom === 'string' && custom.trim() !== ''
      ? custom
      : DEFAULT_NOTIFICATION_TEMPLATES[template];
  }
}
