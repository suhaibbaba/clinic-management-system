import { Controller, Get, Query } from '@nestjs/common';
import {
  APPOINTMENT_STATUS,
  listAppointmentsQuerySchema,
  USER_ROLE,
  type CalendarAppointment,
  type Paginated,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { AppointmentsService } from '@api/appointments/appointments.service';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';

class PendingQueryDto extends createZodDto(listAppointmentsQuerySchema.omit({ status: true })) {}

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
  constructor(private readonly appointments: AppointmentsService) {}

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
}
