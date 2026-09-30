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
import { AUDIT_ACTION, USER_ROLE, type Doctor, type Paginated } from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DOCTORS_ENTITY } from "@api/common/constants/audit-entities";
import { DoctorsService } from "@api/modules/doctors/services/doctors.service";
import { AiTool } from "@api/modules/ai/tools/route-tool.decorator";
import {
  ListDoctorsQueryDto,
  IdParamDto,
  CreateDoctorDto,
  CreateVisitingDoctorDto,
  UpdateDoctorDto,
  UpdateDoctorScheduleDto,
} from "@api/modules/doctors/dto/doctors.dto";

@Controller("doctors")
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListDoctorsQueryDto,
  ): Promise<Paginated<Doctor>> {
    return this.doctorsService.list(actor, query);
  }

  @AiTool({
    group: "schedule",
    description:
      "One doctor in full: name, specialty, weekly hours, default appointment length. Use find_doctors to find the id.",
  })
  @Get(":id")
  findOne(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<Doctor> {
    return this.doctorsService.findOne(actor, params.id);
  }

  @Post()
  @Roles(USER_ROLE.ADMIN)
  @Audit(DOCTORS_ENTITY, AUDIT_ACTION.CREATE)
  create(@CurrentUser() actor: AuthenticatedUser, @Body() body: CreateDoctorDto): Promise<Doctor> {
    return this.doctorsService.create(actor, body);
  }

  @Post("visiting")
  @Roles(USER_ROLE.ADMIN)
  @Audit(DOCTORS_ENTITY, AUDIT_ACTION.CREATE)
  createVisiting(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateVisitingDoctorDto,
  ): Promise<Doctor> {
    return this.doctorsService.createVisiting(actor, body);
  }

  @AiTool({
    group: "schedule",
    description:
      "Change a doctor's profile — specialty or default appointment length. Not their hours: use set_doctor_schedule. Waits on a card.",
  })
  @Patch(":id")
  @Roles(USER_ROLE.ADMIN)
  @Audit(DOCTORS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateDoctorDto,
  ): Promise<Doctor> {
    return this.doctorsService.update(actor, params.id, body);
  }

  @Patch(":id/schedule")
  @Roles(USER_ROLE.DOCTOR)
  @Audit(DOCTORS_ENTITY, AUDIT_ACTION.UPDATE)
  updateSchedule(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateDoctorScheduleDto,
  ): Promise<Doctor> {
    return this.doctorsService.updateSchedule(actor, params.id, body);
  }

  @Delete(":id")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(DOCTORS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.doctorsService.softDelete(actor, params.id);
  }
}
