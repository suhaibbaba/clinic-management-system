import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  APPOINTMENT_STATUS,
  clinicLocale,
  localDate,
  shortDate,
  NOTIFICATION_TEMPLATE,
  type CalendarAppointment,
} from "@clinic/shared";
import { eq } from "drizzle-orm";
import { AppointmentsService } from "@api/modules/appointments/services/appointments.service";
import { BookingTokenService } from "@api/modules/booking/services/booking-token.service";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { type Env } from "@api/config/env.schema";
import { DATABASE, type Database } from "@api/database/database.module";
import { clinics } from "@api/database/schema";
import { NotificationsService } from "@api/modules/notifications/services/notifications.service";
import { timeIn } from "@api/common/lib/time";

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
        date: shortDate(localDate(new Date(appointment.startsAt), clinic.locale.timeZone)),
        time: timeIn(clinic.locale.timeZone, new Date(appointment.startsAt), clinic.locale.clock),
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
        date: shortDate(localDate(new Date(appointment.startsAt), clinic.locale.timeZone)),
        time: timeIn(clinic.locale.timeZone, new Date(appointment.startsAt), clinic.locale.clock),
      },
    });

    return appointment;
  }

  private async clinicFor(clinicId: string) {
    const [row] = await this.db
      .select({ name: clinics.name, country: clinics.country, settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    return { name: row?.name ?? "", locale: clinicLocale(row) };
  }

  private manageLink(appointmentId: string): string {
    const base = this.config.get("PUBLIC_BASE_URL", { infer: true });

    return `${base.replace(/\/$/, "")}/booking/manage/${this.tokens.sign(appointmentId)}`;
  }
}
