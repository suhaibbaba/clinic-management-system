import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  APPOINTMENT_STATUS,
  AUDIT_ACTION,
  availabilityQuerySchema,
  calendarQuerySchema,
  cancelAppointmentSchema,
  createAppointmentSchema,
  idParamSchema,
  listAppointmentsQuerySchema,
  updateAppointmentSchema,
  USER_ROLE,
  type Availability,
  type CalendarAppointment,
  type CalendarFeed,
  type Paginated,
  type Visit,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { AvailabilityService } from '@api/appointments/availability.service';
import { APPOINTMENTS_ENTITY, AppointmentsService } from '@api/appointments/appointments.service';
import { Audit } from '@api/common/decorators/audit.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';

class CreateAppointmentDto extends createZodDto(createAppointmentSchema) {}
class UpdateAppointmentDto extends createZodDto(updateAppointmentSchema) {}
class CancelAppointmentDto extends createZodDto(cancelAppointmentSchema) {}
class ListAppointmentsQueryDto extends createZodDto(listAppointmentsQuerySchema) {}
class CalendarQueryDto extends createZodDto(calendarQuerySchema) {}
class AvailabilityQueryDto extends createZodDto(availabilityQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

/**
 * The internal calendar (ROLES.md appointments matrix).
 *
 * **Reads** are open to every role: the calendar row is `R` for a technician
 * too, and the feed carries no clinical or financial field — a patient's name,
 * phone, file number and the doctor's name are exactly what a block draws.
 *
 * **Writes** are `CRUD` for admin and receptionist and `CRU (own)` for a
 * doctor. The class-level `@Roles` opens writes to doctor and receptionist,
 * and the service refuses a doctor writing to another doctor's calendar —
 * "own" is an object-level rule and object-level rules belong in the service
 * (ROLES.md enforcement step 4).
 *
 * Delete is admin only, like every other soft delete (global rule 5).
 *
 * Public booking is **not** here. It arrives as its own `@Public()`,
 * rate-limited, OTP-gated controller reusing `AvailabilityService`.
 */
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  /* ---------------------------------------------------------------------- */
  /* Reads — every role                                                      */
  /* ---------------------------------------------------------------------- */

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListAppointmentsQueryDto,
  ): Promise<Paginated<CalendarAppointment>> {
    return this.appointmentsService.list(actor, query);
  }

  /** Day or week, one doctor or the whole clinic. The calendar's own feed. */
  @Get('calendar')
  calendar(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: CalendarQueryDto,
  ): Promise<CalendarFeed> {
    return this.appointmentsService.calendar(actor, query);
  }

  /** Free slots for a doctor on a date. Never stored, computed per request. */
  @Get('availability')
  availability(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: AvailabilityQueryDto,
  ): Promise<Availability> {
    return this.availabilityService.forDay(actor.clinicId, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<CalendarAppointment> {
    return this.appointmentsService.findOne(actor, params.id);
  }

  /* ---------------------------------------------------------------------- */
  /* Writes — admin, receptionist, and a doctor on their own calendar        */
  /* ---------------------------------------------------------------------- */

  @Post()
  @Roles(USER_ROLE.RECEPTIONIST, USER_ROLE.DOCTOR)
  @Audit(APPOINTMENTS_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateAppointmentDto,
  ): Promise<CalendarAppointment> {
    return this.appointmentsService.create(actor, body);
  }

  @Patch(':id')
  @Roles(USER_ROLE.RECEPTIONIST, USER_ROLE.DOCTOR)
  @Audit(APPOINTMENTS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateAppointmentDto,
  ): Promise<CalendarAppointment> {
    return this.appointmentsService.update(actor, params.id, body);
  }

  /*
   * One endpoint per transition rather than a `PATCH { status }`.
   *
   * The front desk presses a button called "arrived", not one called "set
   * status"; naming the route after the act is what makes the audit trail
   * readable, and it means cancelling can require its reason in the body
   * schema rather than in a conditional.
   */

  @Patch(':id/confirm')
  @Roles(USER_ROLE.RECEPTIONIST, USER_ROLE.DOCTOR)
  @Audit(APPOINTMENTS_ENTITY, AUDIT_ACTION.UPDATE)
  confirm(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<CalendarAppointment> {
    return this.appointmentsService.changeStatus(actor, params.id, APPOINTMENT_STATUS.CONFIRMED);
  }

  @Patch(':id/arrived')
  @Roles(USER_ROLE.RECEPTIONIST, USER_ROLE.DOCTOR)
  @Audit(APPOINTMENTS_ENTITY, AUDIT_ACTION.UPDATE)
  arrived(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<CalendarAppointment> {
    return this.appointmentsService.changeStatus(actor, params.id, APPOINTMENT_STATUS.ARRIVED);
  }

  @Patch(':id/start')
  @Roles(USER_ROLE.RECEPTIONIST, USER_ROLE.DOCTOR)
  @Audit(APPOINTMENTS_ENTITY, AUDIT_ACTION.UPDATE)
  start(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<CalendarAppointment> {
    return this.appointmentsService.changeStatus(actor, params.id, APPOINTMENT_STATUS.IN_PROGRESS);
  }

  @Patch(':id/complete')
  @Roles(USER_ROLE.RECEPTIONIST, USER_ROLE.DOCTOR)
  @Audit(APPOINTMENTS_ENTITY, AUDIT_ACTION.UPDATE)
  complete(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<CalendarAppointment> {
    return this.appointmentsService.changeStatus(actor, params.id, APPOINTMENT_STATUS.COMPLETED);
  }

  @Patch(':id/no-show')
  @Roles(USER_ROLE.RECEPTIONIST, USER_ROLE.DOCTOR)
  @Audit(APPOINTMENTS_ENTITY, AUDIT_ACTION.UPDATE)
  noShow(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<CalendarAppointment> {
    return this.appointmentsService.changeStatus(actor, params.id, APPOINTMENT_STATUS.NO_SHOW);
  }

  @Patch(':id/cancel')
  @Roles(USER_ROLE.RECEPTIONIST, USER_ROLE.DOCTOR)
  @Audit(APPOINTMENTS_ENTITY, AUDIT_ACTION.UPDATE)
  cancel(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: CancelAppointmentDto,
  ): Promise<CalendarAppointment> {
    return this.appointmentsService.changeStatus(
      actor,
      params.id,
      APPOINTMENT_STATUS.CANCELLED,
      body.reason,
    );
  }

  /**
   * Arrived → the doctor's visit. Creates the visit, links both records.
   *
   * Doctor and admin only: a visit is a clinical record, and ROLES.md gives a
   * receptionist none of them. The audit entry is written against the
   * appointment because that is the row this endpoint changes; the visit's own
   * creation is audited by the visits entity through the same interceptor.
   */
  @Post(':id/visit')
  @Roles(USER_ROLE.DOCTOR)
  @Audit(APPOINTMENTS_ENTITY, AUDIT_ACTION.UPDATE)
  convertToVisit(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<Visit> {
    return this.appointmentsService.convertToVisit(actor, params.id);
  }

  @Delete(':id')
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(APPOINTMENTS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.appointmentsService.softDelete(actor, params.id);
  }
}
