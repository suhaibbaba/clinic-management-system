import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  APPOINTMENT_STATUS,
  bookingSettings,
  clinicScheduleSettings,
  DEFAULT_TIME_ZONE,
  localDate,
} from "@clinic/shared";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { notificationName } from "@api/common/person-name";
import { DATABASE, type Database } from "@api/database/database.module";
import { appointments, clinics, doctors, patients, users } from "@api/database/schema";
import { NotificationsService } from "@api/notifications/services/notifications.service";
import { REMINDERS, WINDOW, MINUTE } from "@api/notifications/constants";
import { timeIn } from "@api/notifications/lib/reminders.scheduler";

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

      if (booking.confirmationMode !== "otp") {
        continue;
      }

      if (Date.now() - row.createdAt.getTime() < booking.holdMinutes * MINUTE) {
        continue;
      }

      await this.db
        .update(appointments)
        .set({
          status: APPOINTMENT_STATUS.CANCELLED,
          cancelledReason: "انتهت مهلة تأكيد الحجز الإلكتروني",
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
