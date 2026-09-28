import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  addDays,
  APPOINTMENT_STATUS,
  appointmentSettings,
  AUDIT_ACTION,
  AUTO_NO_SHOW_DAYS,
  clinicScheduleSettings,
  DEFAULT_TIME_ZONE,
  instantFromLocal,
  localDate,
} from "@clinic/shared";
import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { APPOINTMENTS_ENTITY } from "@api/common/constants/audit-entities";
import { DATABASE, type Database } from "@api/database/database.module";
import { appointments, clinics } from "@api/database/schema";
import { toAppointment, type AppointmentRow } from "@api/modules/appointments/lib/appointments";
import { DAY_MS } from "@api/modules/appointments/constants";
import { AuditService } from "@api/modules/audit/services/audit.service";

@Injectable()
export class NoShowScheduler {
  private readonly logger = new Logger(NoShowScheduler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    await this.markNoShows();
  }

  async markNoShows(now: Date = new Date()): Promise<number> {
    const earliestCutoff = new Date(now.getTime() - AUTO_NO_SHOW_DAYS.MIN * DAY_MS);
    const candidates = await this.db
      .select({ appointment: appointments, settings: clinics.settings })
      .from(appointments)
      .innerJoin(clinics, eq(clinics.id, appointments.clinicId))
      .where(
        and(
          isNull(appointments.deletedAt),
          eq(appointments.status, APPOINTMENT_STATUS.CONFIRMED),
          lt(appointments.startsAt, earliestCutoff),
        ),
      );

    const due = new Map<string, AppointmentRow[]>();

    for (const { appointment, settings } of candidates) {
      if (appointment.startsAt >= noShowCutoff(settings, now)) {
        continue;
      }

      due.set(appointment.clinicId, [...(due.get(appointment.clinicId) ?? []), appointment]);
    }

    let marked = 0;

    for (const [clinicId, rows] of due) {
      marked += await this.markClinic(clinicId, rows, now);
    }

    if (marked > 0) {
      this.logger.log(`Marked ${marked} unattended appointment(s) as no-show`);
    }

    return marked;
  }

  private async markClinic(
    clinicId: string,
    rows: readonly AppointmentRow[],
    now: Date,
  ): Promise<number> {
    const before = new Map(rows.map((row) => [row.id, row]));

    return this.db.transaction(async (tx) => {
      const changed = await tx
        .update(appointments)
        .set({ status: APPOINTMENT_STATUS.NO_SHOW, updatedAt: now, updatedBy: null })
        .where(
          and(
            eq(appointments.clinicId, clinicId),
            eq(appointments.status, APPOINTMENT_STATUS.CONFIRMED),
            inArray(appointments.id, [...before.keys()]),
          ),
        )
        .returning();

      for (const after of changed) {
        const old = before.get(after.id);

        await this.audit.record(
          {
            clinicId,
            userId: null,
            action: AUDIT_ACTION.UPDATE,
            entity: APPOINTMENTS_ENTITY,
            entityId: after.id,
            oldValue: old ? toAppointment(old) : null,
            newValue: toAppointment(after),
          },
          tx,
        );
      }

      return changed.length;
    });
  }
}

function noShowCutoff(settings: unknown, now: Date): Date {
  const zone = clinicScheduleSettings(settings).timezone || DEFAULT_TIME_ZONE;
  const days = appointmentSettings(settings).autoNoShowDays;

  return instantFromLocal(addDays(localDate(now, zone), -days), 0, zone);
}
