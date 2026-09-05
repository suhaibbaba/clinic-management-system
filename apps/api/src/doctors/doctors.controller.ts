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
  createDoctorSchema,
  idParamSchema,
  listDoctorsQuerySchema,
  updateDoctorScheduleSchema,
  updateDoctorSchema,
  USER_ROLE,
  type Doctor,
  type Paginated,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { Audit } from '@api/common/decorators/audit.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DOCTORS_ENTITY, DoctorsService } from '@api/doctors/doctors.service';

class CreateDoctorDto extends createZodDto(createDoctorSchema) {}
class UpdateDoctorDto extends createZodDto(updateDoctorSchema) {}
class UpdateDoctorScheduleDto extends createZodDto(updateDoctorScheduleSchema) {}
class ListDoctorsQueryDto extends createZodDto(listDoctorsQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

/**
 * Doctors & schedules (ROLES.md core matrix): every role reads, only admin
 * writes, and a doctor may update their own schedule — that last check is
 * ownership, so it lives in the service.
 */
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListDoctorsQueryDto,
  ): Promise<Paginated<Doctor>> {
    return this.doctorsService.list(actor, query);
  }

  @Get(':id')
  findOne(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<Doctor> {
    return this.doctorsService.findOne(actor, params.id);
  }

  @Post()
  @Roles(USER_ROLE.ADMIN)
  @Audit(DOCTORS_ENTITY, AUDIT_ACTION.CREATE)
  create(@CurrentUser() actor: AuthenticatedUser, @Body() body: CreateDoctorDto): Promise<Doctor> {
    return this.doctorsService.create(actor, body);
  }

  @Patch(':id')
  @Roles(USER_ROLE.ADMIN)
  @Audit(DOCTORS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateDoctorDto,
  ): Promise<Doctor> {
    return this.doctorsService.update(actor, params.id, body);
  }

  /** Admin, or the doctor who owns this row. */
  @Patch(':id/schedule')
  @Roles(USER_ROLE.DOCTOR)
  @Audit(DOCTORS_ENTITY, AUDIT_ACTION.UPDATE)
  updateSchedule(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateDoctorScheduleDto,
  ): Promise<Doctor> {
    return this.doctorsService.updateSchedule(actor, params.id, body);
  }

  @Delete(':id')
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
