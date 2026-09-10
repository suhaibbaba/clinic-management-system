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

const rejectBookingSchema = z.object({ reason: z.string().trim().min(3).max(300) });
class RejectBookingDto extends createZodDto(rejectBookingSchema) {}

// `requested` is itself the marker for "came from the public page" — reception's own bookings start
// `confirmed`, so no extra column is needed.
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

  // Its own endpoint because the patient is not in the building: confirming also tells them, with
  // the manage link an OTP confirmation would have sent.
  @Patch(':id/confirm')
  confirm(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<CalendarAppointment> {
    return this.pending.confirm(actor, params.id);
  }

  @Patch(':id/reject')
  reject(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: RejectBookingDto,
  ): Promise<CalendarAppointment> {
    return this.pending.reject(actor, params.id, body.reason);
  }
}
