import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  AUDIT_ACTION,
  createDoctorExtraHoursSchema,
  idParamSchema,
  listDoctorExtraHoursQuerySchema,
  USER_ROLE,
  type DoctorExtraHours,
  type Paginated,
} from "@clinic/shared";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import {
  DOCTOR_EXTRA_HOURS_ENTITY,
  DoctorExtraHoursService,
} from "@api/schedule/doctor-extra-hours.service";
import { AiTool } from "@api/ai/tools/route-tool.decorator";

class CreateDoctorExtraHoursDto extends createZodDto(createDoctorExtraHoursSchema) {}
class ListDoctorExtraHoursQueryDto extends createZodDto(listDoctorExtraHoursQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}
class DoctorParamDto extends createZodDto(z.object({ doctorId: z.uuid() })) {}

@Controller()
export class DoctorExtraHoursController {
  constructor(private readonly extraHours: DoctorExtraHoursService) {}

  @AiTool({
    group: "schedule",
    description:
      "A doctor's extra hours on specific dates. Returns a page of dates with their hours.",
  })
  @Get("doctors/:doctorId/extra-hours")
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: DoctorParamDto,
    @Query() query: ListDoctorExtraHoursQueryDto,
  ): Promise<Paginated<DoctorExtraHours>> {
    return this.extraHours.list(actor, params.doctorId, query);
  }

  @Post("doctors/:doctorId/extra-hours")
  @Roles(USER_ROLE.DOCTOR)
  @Audit(DOCTOR_EXTRA_HOURS_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: "response" })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: DoctorParamDto,
    @Body() body: CreateDoctorExtraHoursDto,
  ): Promise<DoctorExtraHours> {
    return this.extraHours.create(actor, params.doctorId, body);
  }

  @AiTool({
    group: "schedule",
    description: "Take back extra hours given on a date. Waits on a typed confirmation.",
  })
  @Delete("doctor-extra-hours/:id")
  @Roles(USER_ROLE.DOCTOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(DOCTOR_EXTRA_HOURS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.extraHours.softDelete(actor, params.id);
  }
}
