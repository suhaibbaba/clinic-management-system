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
  USER_ROLE,
  type DoctorTimeOff,
  type DoctorTimeOffResult,
  type Paginated,
} from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DOCTOR_TIME_OFF_ENTITY } from "@api/modules/schedule/constants";
import { DoctorTimeOffService } from "@api/modules/schedule/services/doctor-time-off.service";
import { AiTool } from "@api/modules/ai/tools/route-tool.decorator";
import {
  DoctorParamDto,
  ListDoctorTimeOffQueryDto,
  CreateDoctorTimeOffDto,
  ConflictOptionsDto,
  IdParamDto,
  UpdateDoctorTimeOffDto,
} from "@api/modules/schedule/dto/doctor-time-off.dto";

@Controller()
export class DoctorTimeOffController {
  constructor(private readonly timeOff: DoctorTimeOffService) {}

  @AiTool({
    group: "schedule",
    description:
      "A doctor's time off overlapping a window of instants. Use to find the time_off_id to change or remove.",
  })
  @Get("doctors/:doctorId/time-off")
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: DoctorParamDto,
    @Query() query: ListDoctorTimeOffQueryDto,
  ): Promise<Paginated<DoctorTimeOff>> {
    return this.timeOff.list(actor, params.doctorId, query);
  }

  @Post("doctors/:doctorId/time-off")
  @Roles(USER_ROLE.DOCTOR)
  @Audit(DOCTOR_TIME_OFF_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: "response" })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: DoctorParamDto,
    @Body() body: CreateDoctorTimeOffDto,
    @Query() options: ConflictOptionsDto,
  ): Promise<DoctorTimeOffResult> {
    return this.timeOff.create(actor, params.doctorId, body, options);
  }

  @Patch("doctor-time-off/:id")
  @Roles(USER_ROLE.DOCTOR)
  @Audit(DOCTOR_TIME_OFF_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateDoctorTimeOffDto,
    @Query() options: ConflictOptionsDto,
  ): Promise<DoctorTimeOffResult> {
    return this.timeOff.update(actor, params.id, body, options);
  }

  @Delete("doctor-time-off/:id")
  @Roles(USER_ROLE.DOCTOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(DOCTOR_TIME_OFF_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.timeOff.softDelete(actor, params.id);
  }
}
