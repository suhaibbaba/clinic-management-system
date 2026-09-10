import { Injectable } from '@nestjs/common';
import {
  APPOINTMENT_STATUS,
  DASHBOARD_SCHEDULE_LIMIT,
  USER_ROLE,
  type DashboardSummary,
} from '@clinic/shared';

import { AppointmentAccessService } from '@api/appointments/appointment-access.service';
import { AppointmentsService } from '@api/appointments/appointments.service';
import { OverdueService } from '@api/billing/overdue.service';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';

// Nothing here is a new source of truth — it arranges the calendar's, the queue's and the overdue
// service's own queries, and shapes the response by role.
@Injectable()
export class DashboardService {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly access: AppointmentAccessService,
    private readonly overdue: OverdueService,
  ) {}

  async summary(actor: AuthenticatedUser): Promise<DashboardSummary> {
    const date = await this.appointments.localToday(actor.clinicId);

    // "R (own KPIs)": a doctor's dashboard is their day. One whose account has no `doctors` row
    // gets the empty one rather than everybody's.
    const ownDoctorId = await this.access.ownDoctorId(actor);
    const unmatchedDoctor = actor.role === USER_ROLE.DOCTOR && ownDoctorId === null;

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
    if (actor.role !== USER_ROLE.ADMIN && actor.role !== USER_ROLE.RECEPTIONIST) {
      return undefined;
    }

    // `limit: 1` — only the total is wanted, and the API returns it either way.
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
    if (actor.role !== USER_ROLE.ADMIN && actor.role !== USER_ROLE.RECEPTIONIST) {
      return undefined;
    }

    return this.overdue.total(actor.clinicId);
  }
}
