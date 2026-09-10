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
  AUDIT_ACTION,
  createDoctorTimeOffSchema,
  idParamSchema,
  listDoctorTimeOffQuerySchema,
  scheduleConflictOptionsSchema,
  updateDoctorTimeOffSchema,
  USER_ROLE,
  type DoctorTimeOff,
  type DoctorTimeOffResult,
  type Paginated,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { Audit } from '@api/common/decorators/audit.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import {
  DOCTOR_TIME_OFF_ENTITY,
  DoctorTimeOffService,
} from '@api/schedule/doctor-time-off.service';

class CreateDoctorTimeOffDto extends createZodDto(createDoctorTimeOffSchema) {}
class UpdateDoctorTimeOffDto extends createZodDto(updateDoctorTimeOffSchema) {}
class ListDoctorTimeOffQueryDto extends createZodDto(listDoctorTimeOffQuerySchema) {}
class ConflictOptionsDto extends createZodDto(scheduleConflictOptionsSchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}
class DoctorParamDto extends createZodDto(z.object({ doctorId: z.uuid() })) {}

// Every role reads, admin writes any, a doctor writes their own — that check is ownership, so it
// uses the same `AppointmentAccessService` rule as appointments.
@Controller()
export class DoctorTimeOffController {
  constructor(private readonly timeOff: DoctorTimeOffService) {}

  @Get('doctors/:doctorId/time-off')
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: DoctorParamDto,
    @Query() query: ListDoctorTimeOffQueryDto,
  ): Promise<Paginated<DoctorTimeOff>> {
    return this.timeOff.list(actor, params.doctorId, query);
  }

  @Post('doctors/:doctorId/time-off')
  @Roles(USER_ROLE.DOCTOR)
  @Audit(DOCTOR_TIME_OFF_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: 'response' })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: DoctorParamDto,
    @Body() body: CreateDoctorTimeOffDto,
    @Query() options: ConflictOptionsDto,
  ): Promise<DoctorTimeOffResult> {
    return this.timeOff.create(actor, params.doctorId, body, options);
  }

  @Patch('doctor-time-off/:id')
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

  @Delete('doctor-time-off/:id')
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
