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

// Reads are open to every role (no clinical or financial field in the feed); "own" is object-level
// and lives in the service; delete is admin only.
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListAppointmentsQueryDto,
  ): Promise<Paginated<CalendarAppointment>> {
    return this.appointmentsService.list(actor, query);
  }

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

  // One endpoint per transition rather than `PATCH { status }`: it names the act for the audit
  // trail, and cancelling can require its reason in the schema.

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

  // Doctor and admin only — a visit is a clinical record. The audit entry is on the appointment,
  // which is the row this changes.
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
