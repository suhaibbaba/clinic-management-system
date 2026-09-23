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
  AUDIT_ACTION,
  createDoctorSchema,
  idParamSchema,
  listDoctorsQuerySchema,
  updateDoctorScheduleSchema,
  updateDoctorSchema,
  USER_ROLE,
  type Doctor,
  type Paginated,
} from "@clinic/shared";
import { createZodDto } from "nestjs-zod";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DOCTORS_ENTITY, DoctorsService } from "@api/doctors/doctors.service";
import { AiTool } from "@api/ai/tools/route-tool.decorator";

class CreateDoctorDto extends createZodDto(createDoctorSchema) {}
class UpdateDoctorDto extends createZodDto(updateDoctorSchema) {}
class UpdateDoctorScheduleDto extends createZodDto(updateDoctorScheduleSchema) {}
class ListDoctorsQueryDto extends createZodDto(listDoctorsQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

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
