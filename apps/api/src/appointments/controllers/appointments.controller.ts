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
} from "@nestjs/common";
import {
  APPOINTMENT_STATUS,
  AUDIT_ACTION,
  USER_ROLE,
  type Availability,
  type CalendarAppointment,
  type CalendarFeed,
  type Paginated,
  type Visit,
} from "@clinic/shared";
import { AvailabilityService } from "@api/appointments/services/availability.service";
import { APPOINTMENTS_ENTITY } from "@api/appointments/constants";
import { AppointmentsService } from "@api/appointments/services/appointments.service";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { AiTool } from "@api/ai/tools/route-tool.decorator";
import {
  ListAppointmentsQueryDto,
  CalendarQueryDto,
  AvailabilityQueryDto,
  IdParamDto,
  CreateAppointmentDto,
  UpdateAppointmentDto,
  CancelAppointmentDto,
} from "@api/appointments/dto/appointments.dto";

@Controller("appointments")
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

  @Get("calendar")
  calendar(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: CalendarQueryDto,
  ): Promise<CalendarFeed> {
    return this.appointmentsService.calendar(actor, query);
  }

  @Get("availability")
  availability(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: AvailabilityQueryDto,
  ): Promise<Availability> {
    return this.availabilityService.forDay(actor.clinicId, query);
  }

  @AiTool({
    group: "appointments",
    description:
      "One appointment by id, with its patient, doctor, time and status. Use after get_appointments when you need one row in full; not to list — use get_appointments.",
  })
  @Get(":id")
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

  @Patch(":id")
  @Roles(USER_ROLE.RECEPTIONIST, USER_ROLE.DOCTOR)
  @Audit(APPOINTMENTS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateAppointmentDto,
  ): Promise<CalendarAppointment> {
    return this.appointmentsService.update(actor, params.id, body);
  }

  @Patch(":id/confirm")
  @Roles(USER_ROLE.RECEPTIONIST, USER_ROLE.DOCTOR)
  @Audit(APPOINTMENTS_ENTITY, AUDIT_ACTION.UPDATE)
  confirm(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<CalendarAppointment> {
    return this.appointmentsService.changeStatus(actor, params.id, APPOINTMENT_STATUS.CONFIRMED);
  }

  @Patch(":id/arrived")
  @Roles(USER_ROLE.RECEPTIONIST, USER_ROLE.DOCTOR)
  @Audit(APPOINTMENTS_ENTITY, AUDIT_ACTION.UPDATE)
  arrived(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<CalendarAppointment> {
    return this.appointmentsService.changeStatus(actor, params.id, APPOINTMENT_STATUS.ARRIVED);
  }

  @Patch(":id/start")
  @Roles(USER_ROLE.RECEPTIONIST, USER_ROLE.DOCTOR)
  @Audit(APPOINTMENTS_ENTITY, AUDIT_ACTION.UPDATE)
  start(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<CalendarAppointment> {
    return this.appointmentsService.changeStatus(actor, params.id, APPOINTMENT_STATUS.IN_PROGRESS);
  }

  @Patch(":id/complete")
  @Roles(USER_ROLE.RECEPTIONIST, USER_ROLE.DOCTOR)
  @Audit(APPOINTMENTS_ENTITY, AUDIT_ACTION.UPDATE)
  complete(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<CalendarAppointment> {
    return this.appointmentsService.changeStatus(actor, params.id, APPOINTMENT_STATUS.COMPLETED);
  }

  @Patch(":id/no-show")
  @Roles(USER_ROLE.RECEPTIONIST, USER_ROLE.DOCTOR)
  @Audit(APPOINTMENTS_ENTITY, AUDIT_ACTION.UPDATE)
  noShow(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<CalendarAppointment> {
    return this.appointmentsService.changeStatus(actor, params.id, APPOINTMENT_STATUS.NO_SHOW);
  }

  @Patch(":id/cancel")
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

  @Post(":id/visit")
  @Roles(USER_ROLE.DOCTOR)
  @Audit(APPOINTMENTS_ENTITY, AUDIT_ACTION.UPDATE)
  convertToVisit(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<Visit> {
    return this.appointmentsService.convertToVisit(actor, params.id);
  }

  @Delete(":id")
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
