import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  APPOINTMENT_STATUS,
  bookingSettings,
  clinicScheduleSettings,
  DEFAULT_TIME_ZONE,
  localDate,
  minutesFromLocalMidnight,
  NOTIFICATION_TEMPLATE,
  type NotificationTemplate,
} from '@clinic/shared';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';

import { notificationName } from '@api/common/person-name';
import { DATABASE, type Database } from '@api/database/database.module';
import { appointments, clinics, doctors, patients, users } from '@api/database/schema';
import { NotificationsService } from '@api/notifications/notifications.service';

const HOUR = 3_600_000;
const MINUTE = 60_000;

// The job runs every five minutes, so a ten-minute window sees every appointment even if a run is
// skipped — and seeing one twice costs nothing, the log being the dedupe.
const WINDOW = 10 * MINUTE;

interface Reminder {
  readonly template: NotificationTemplate;
  readonly leadMs: number;
  readonly setting: 'remind24h' | 'remind2h';
}

const REMINDERS: readonly Reminder[] = [
  { template: NOTIFICATION_TEMPLATE.REMINDER_24H, leadMs: 24 * HOUR, setting: 'remind24h' },
  { template: NOTIFICATION_TEMPLATE.REMINDER_2H, leadMs: 2 * HOUR, setting: 'remind2h' },
];

// A held booking is a real `requested` appointment, so the same constraint blocks the slot; expiry
// cancels with a reason rather than deleting. Both jobs are per-clinic and swallow their failures.
@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger(RemindersScheduler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async run(): Promise<void> {
    await this.sendReminders();
    await this.releaseExpiredHolds();
  }

  /** Exposed for the tests, which drive the job rather than waiting for cron. */
  async sendReminders(): Promise<number> {
    const now = Date.now();
    let sent = 0;

    for (const reminder of REMINDERS) {
      const from = new Date(now + reminder.leadMs);
      const to = new Date(now + reminder.leadMs + WINDOW);

      const due = await this.db
        .select({
          id: appointments.id,
          clinicId: appointments.clinicId,
          startsAt: appointments.startsAt,
          phone: patients.phone,
          doctorNameAr: users.nameAr,
          doctorNameEn: users.nameEn,
          clinicNameAr: clinics.nameAr,
          clinicNameEn: clinics.nameEn,
          settings: clinics.settings,
        })
        .from(appointments)
        .innerJoin(patients, eq(patients.id, appointments.patientId))
        .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
        .innerJoin(users, eq(users.id, doctors.userId))
        .innerJoin(clinics, eq(clinics.id, appointments.clinicId))
        .where(
          and(
            isNull(appointments.deletedAt),
            // Confirmed only. A `requested` booking is not a commitment yet,
            // and reminding someone about a cancelled one is worse than silence.
            eq(appointments.status, APPOINTMENT_STATUS.CONFIRMED),
            gt(appointments.startsAt, from),
            lt(appointments.startsAt, to),
          ),
        );

      for (const row of due) {
        const settings = clinicScheduleSettings(row.settings);
        const notify = await this.notifications.settingsFor(row.clinicId);

        if (!notify[reminder.setting]) {
          continue;
        }

        if (await this.notifications.alreadySent(row.id, reminder.template)) {
          continue;
        }

        const zone = settings.timezone || DEFAULT_TIME_ZONE;

        await this.notifications.send({
          clinicId: row.clinicId,
          to: row.phone,
          template: reminder.template,
          appointmentId: row.id,
          vars: {
            clinic: notificationName({ ar: row.clinicNameAr, en: row.clinicNameEn }),
            doctor: notificationName({ ar: row.doctorNameAr, en: row.doctorNameEn }),
            date: localDate(row.startsAt, zone),
            time: timeIn(zone, row.startsAt),
          },
        });

        sent += 1;
      }
    }

    return sent;
  }

  // Cancelled rather than deleted, so reception can see that someone tried and did not finish. The
  // reason is Arabic because it is read on the appointment.
  async releaseExpiredHolds(): Promise<number> {
    const rows = await this.db
      .select({
        id: appointments.id,
        createdAt: appointments.createdAt,
        settings: clinics.settings,
      })
      .from(appointments)
      .innerJoin(clinics, eq(clinics.id, appointments.clinicId))
      .where(
        and(isNull(appointments.deletedAt), eq(appointments.status, APPOINTMENT_STATUS.REQUESTED)),
      );

    let released = 0;

    for (const row of rows) {
      const booking = bookingSettings(row.settings);

      // Manual confirmation means reception rings back; there is no hold to
      // expire, and dropping those would delete the clinic's own to-do list.
      if (booking.confirmationMode !== 'otp') {
        continue;
      }

      if (Date.now() - row.createdAt.getTime() < booking.holdMinutes * MINUTE) {
        continue;
      }

      await this.db
        .update(appointments)
        .set({
          status: APPOINTMENT_STATUS.CANCELLED,
          cancelledReason: 'انتهت مهلة تأكيد الحجز الإلكتروني',
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, row.id));

      released += 1;
    }

    if (released > 0) {
      this.logger.log(`Released ${released} unconfirmed booking hold(s)`);
    }

    return released;
  }
}

function timeIn(timeZone: string, at: Date): string {
  const minutes = minutesFromLocalMidnight(at, localDate(at, timeZone), timeZone);
  const hours = Math.floor(minutes / 60);

  return `${String(hours).padStart(2, '0')}:${String(Math.round(minutes % 60)).padStart(2, '0')}`;
}
