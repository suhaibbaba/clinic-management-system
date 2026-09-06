import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  APPOINTMENT_STATUS,
  clinicScheduleSettings,
  DEFAULT_TIME_ZONE,
  localDate,
  minutesFromLocalMidnight,
  NOTIFICATION_TEMPLATE,
  type CalendarAppointment,
} from '@clinic/shared';
import { eq } from 'drizzle-orm';

import { AppointmentsService } from '@api/appointments/appointments.service';
import { BookingTokenService } from '@api/booking/booking-token.service';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import type { Env } from '@api/config/env.schema';
import { DATABASE, type Database } from '@api/database/database.module';
import { clinics } from '@api/database/schema';
import { NotificationsService } from '@api/notifications/notifications.service';

/**
 * Reception answering an online booking.
 *
 * The state change itself is `AppointmentsService.changeStatus` — the same one
 * door into the state machine every other transition goes through, so the
 * transition table, the ownership check and the audit trail all still apply.
 * What this adds is the half that only exists for *online* bookings: the
 * patient is not in the building, so a decision they never hear about is not a
 * decision. Confirming sends the same message the OTP path sends, manage link
 * and all; rejecting sends the cancellation.
 *
 * A message that fails to go out never fails the confirmation:
 * `NotificationsService.send` records a `failed` row and resolves, because a
 * dead SMS gateway must not leave reception unable to confirm anybody.
 */
@Injectable()
export class PendingBookingsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly appointments: AppointmentsService,
    private readonly notifications: NotificationsService,
    private readonly tokens: BookingTokenService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async confirm(actor: AuthenticatedUser, id: string): Promise<CalendarAppointment> {
    const appointment = await this.appointments.changeStatus(
      actor,
      id,
      APPOINTMENT_STATUS.CONFIRMED,
    );

    const clinic = await this.clinicFor(actor.clinicId);

    await this.notifications.send({
      clinicId: actor.clinicId,
      to: appointment.patientPhone,
      template: NOTIFICATION_TEMPLATE.BOOKING_CONFIRMED,
      appointmentId: appointment.id,
      vars: {
        clinic: clinic.name,
        doctor: appointment.doctorName,
        date: localDate(new Date(appointment.startsAt), clinic.timeZone),
        time: timeIn(clinic.timeZone, new Date(appointment.startsAt)),
        // The same signed handle the patient would have got from an OTP
        // confirmation: reception confirming by hand must not leave them
        // without a way to cancel.
        link: this.manageLink(appointment.id),
      },
    });

    return appointment;
  }

  async reject(actor: AuthenticatedUser, id: string, reason: string): Promise<CalendarAppointment> {
    const appointment = await this.appointments.changeStatus(
      actor,
      id,
      APPOINTMENT_STATUS.CANCELLED,
      reason,
    );

    const clinic = await this.clinicFor(actor.clinicId);

    await this.notifications.send({
      clinicId: actor.clinicId,
      to: appointment.patientPhone,
      template: NOTIFICATION_TEMPLATE.BOOKING_CANCELLED,
      appointmentId: appointment.id,
      vars: {
        clinic: clinic.name,
        date: localDate(new Date(appointment.startsAt), clinic.timeZone),
        time: timeIn(clinic.timeZone, new Date(appointment.startsAt)),
      },
    });

    return appointment;
  }

  private async clinicFor(clinicId: string): Promise<{ name: string; timeZone: string }> {
    const [row] = await this.db
      .select({ name: clinics.name, settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    return {
      name: row?.name ?? '',
      timeZone: clinicScheduleSettings(row?.settings).timezone || DEFAULT_TIME_ZONE,
    };
  }

  private manageLink(appointmentId: string): string {
    const base = this.config.get('PUBLIC_BASE_URL', { infer: true });

    return `${base.replace(/\/$/, '')}/booking/manage/${this.tokens.sign(appointmentId)}`;
  }
}

/** `HH:MM` in the clinic's zone, for a message body. */
function timeIn(timeZone: string, at: Date): string {
  const minutes = minutesFromLocalMidnight(at, localDate(at, timeZone), timeZone);
  const hours = Math.floor(minutes / 60);

  return `${String(hours).padStart(2, '0')}:${String(Math.round(minutes % 60)).padStart(2, '0')}`;
}
