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

class CreateDoctorExtraHoursDto extends createZodDto(createDoctorExtraHoursSchema) {}
class ListDoctorExtraHoursQueryDto extends createZodDto(listDoctorExtraHoursQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}
class DoctorParamDto extends createZodDto(z.object({ doctorId: z.uuid() })) {}

@Controller()
export class DoctorExtraHoursController {
  constructor(private readonly extraHours: DoctorExtraHoursService) {}

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
