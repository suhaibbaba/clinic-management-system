import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  APPOINTMENT_STATUS,
  listAppointmentsQuerySchema,
  uuidSchema,
  USER_ROLE,
  type CalendarAppointment,
  type Paginated,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { AppointmentsService } from '@api/appointments/appointments.service';
import { PendingBookingsService } from '@api/booking/pending-bookings.service';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';

class PendingQueryDto extends createZodDto(listAppointmentsQuerySchema.omit({ status: true })) {}
class IdParamDto extends createZodDto(z.object({ id: uuidSchema })) {}

/**
 * A rejection states why, like every other cancellation in the system — the
 * reason is what the patient is told and what the next receptionist reads.
 */
const rejectBookingSchema = z.object({ reason: z.string().trim().min(3).max(300) });
class RejectBookingDto extends createZodDto(rejectBookingSchema) {}

/**
 * Bookings a patient made online that reception has not dealt with yet.
 *
 * Internal, authenticated, receptionist and admin — ROLES.md gives the
 * appointments row `CRUD` to both, and this is a filtered read of it. A doctor
 * is deliberately not here: chasing unconfirmed bookings is front-desk work,
 * and their own calendar already shows the ones that concern them.
 *
 * `requested` *is* the marker for "came from the public page": reception's own
 * bookings are created `confirmed`, so no extra column is needed to tell the
 * two apart. It also means an OTP booking that expires leaves this list by
 * itself, because the hold-expiry job cancels it.
 */
@Controller('appointments/pending-confirmation')
@Roles(USER_ROLE.RECEPTIONIST)
export class PendingBookingsController {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly pending: PendingBookingsService,
  ) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: PendingQueryDto,
  ): Promise<Paginated<CalendarAppointment>> {
    return this.appointments.list(actor, {
      ...query,
      status: APPOINTMENT_STATUS.REQUESTED,
    });
  }

  /**
   * Reception says yes.
   *
   * The transition itself is the ordinary one; what makes this its own
   * endpoint is that the patient is not in the building, so confirming also
   * tells them — with the same manage link an OTP confirmation would have
   * sent.
   */
  @Patch(':id/confirm')
  confirm(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<CalendarAppointment> {
    return this.pending.confirm(actor, params.id);
  }

  /** Reception says no, and the patient is told why rather than left waiting. */
  @Patch(':id/reject')
  reject(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: RejectBookingDto,
  ): Promise<CalendarAppointment> {
    return this.pending.reject(actor, params.id, body.reason);
  }
}
