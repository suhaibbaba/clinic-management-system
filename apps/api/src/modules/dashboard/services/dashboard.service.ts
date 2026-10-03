import { Injectable } from "@nestjs/common";
import {
  APPOINTMENT_STATUS,
  DASHBOARD_SCHEDULE_LIMIT,
  RULE,
  type DashboardSummary,
} from "@clinic/shared";
import { AppointmentAccessService } from "@api/modules/appointments/services/appointment-access.service";
import { AppointmentsService } from "@api/modules/appointments/services/appointments.service";
import { OverdueService } from "@api/modules/billing/services/overdue.service";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";

@Injectable()
export class DashboardService {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly access: AppointmentAccessService,
    private readonly overdue: OverdueService,
    private readonly permissions: PermissionsService,
  ) {}

  async summary(actor: AuthenticatedUser): Promise<DashboardSummary> {
    const date = await this.appointments.localToday(actor.clinicId);

    const ownDoctorId = await this.access.ownDoctorId(actor);
    const unmatchedDoctor = ownDoctorId === null && !(await this.access.seesAllCalendars(actor));

    const today = unmatchedDoctor
      ? undefined
      : await this.appointments.list(actor, {
          page: 1,
          limit: DASHBOARD_SCHEDULE_LIMIT,
          from: date,
          to: date,
          ...(ownDoctorId !== null && { doctorId: ownDoctorId }),
        });

    const [pending, overdue] = await Promise.all([
      this.pendingBookings(actor),
      this.overdueTotal(actor),
    ]);

    return {
      date,
      appointmentsToday: today?.total ?? 0,
      ...(pending !== undefined && { pendingBookings: pending }),
      ...(overdue !== undefined && {
        overdueTotal: overdue.total,
        overduePatients: overdue.patients,
      }),
      schedule: today?.items ?? [],
    };
  }

  private async pendingBookings(actor: AuthenticatedUser): Promise<number | undefined> {
    if (!(await this.permissions.can(actor, "pending-bookings.list"))) {
      return undefined;
    }

    const pending = await this.appointments.list(actor, {
      page: 1,
      limit: 1,
      status: APPOINTMENT_STATUS.REQUESTED,
    });

    return pending.total;
  }

  private async overdueTotal(
    actor: AuthenticatedUser,
  ): Promise<{ total: string; patients: number } | undefined> {
    if (!(await this.permissions.can(actor, RULE.OVERDUE_WIDGET))) {
      return undefined;
    }

    return this.overdue.total(actor.clinicId);
  }
}
