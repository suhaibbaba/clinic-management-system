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

/**
 * The landing page's figures, gathered once.
 *
 * Nothing here is a new source of truth: today's list is the calendar's own
 * query, the pending count is the same filtered read reception's queue makes,
 * and the overdue figure is the overdue service's aggregate. The dashboard
 * *arranges* those; if it computed any of them its own way, the number on the
 * card and the number on the page it links to would drift apart.
 *
 * Which of them a caller gets is decided here rather than on the screen, so a
 * technician's response carries no money and a doctor's carries no booking
 * queue — the ROLES.md rows, applied to the response rather than to the
 * rendering (enforcement step 5).
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly access: AppointmentAccessService,
    private readonly overdue: OverdueService,
  ) {}

  async summary(actor: AuthenticatedUser): Promise<DashboardSummary> {
    const date = await this.appointments.localToday(actor.clinicId);

    // "R (own KPIs)" in the ROLES.md reports row: a doctor's dashboard is
    // their day, not the clinic's. A doctor whose user account has no
    // `doctors` row yet has no calendar of their own, and gets the empty one
    // rather than everybody's.
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

  /**
   * Online bookings waiting on an answer — front desk only.
   *
   * Same rule as the queue itself: ROLES.md gives the appointments row to
   * admin and receptionist, and a doctor's own calendar already shows the
   * bookings that concern them.
   */
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

  /** The overdue card. ROLES.md "Overdue balances list": admin and reception. */
  private async overdueTotal(
    actor: AuthenticatedUser,
  ): Promise<{ total: string; patients: number } | undefined> {
    if (actor.role !== USER_ROLE.ADMIN && actor.role !== USER_ROLE.RECEPTIONIST) {
      return undefined;
    }

    return this.overdue.total(actor.clinicId);
  }
}
