import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import {
  APPOINTMENT_STATUS,
  USER_ROLE,
  type CalendarAppointment,
  type Paginated,
} from "@clinic/shared";
import { AppointmentsService } from "@api/modules/appointments/services/appointments.service";
import { PendingBookingsService } from "@api/modules/booking/services/pending-bookings.service";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import {
  PendingQueryDto,
  IdParamDto,
  RejectBookingDto,
} from "@api/modules/booking/dto/pending-bookings.dto";

@Controller("appointments/pending-confirmation")
@Roles(USER_ROLE.RECEPTIONIST)
export class PendingBookingsController {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly pending: PendingBookingsService,
  ) {}

  @Get()
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST)
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: PendingQueryDto,
  ): Promise<Paginated<CalendarAppointment>> {
    return this.appointments.list(actor, {
      ...query,
      status: APPOINTMENT_STATUS.REQUESTED,
    });
  }

  @Patch(":id/confirm")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST)
  confirm(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<CalendarAppointment> {
    return this.pending.confirm(actor, params.id);
  }

  @Patch(":id/reject")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST)
  reject(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: RejectBookingDto,
  ): Promise<CalendarAppointment> {
    return this.pending.reject(actor, params.id, body.reason);
  }
}
