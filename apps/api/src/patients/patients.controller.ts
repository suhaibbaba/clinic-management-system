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
  createPatientSchema,
  idParamSchema,
  listPatientsQuerySchema,
  updatePatientSchema,
  USER_ROLE,
  type Paginated,
  type PatientView,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { Audit } from '@api/common/decorators/audit.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { PATIENTS_ENTITY, PatientsService } from '@api/patients/patients.service';

class CreatePatientDto extends createZodDto(createPatientSchema) {}
class UpdatePatientDto extends createZodDto(updatePatientSchema) {}
class ListPatientsQueryDto extends createZodDto(listPatientsQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

// The response shape is chosen by role inside the service: a receptionist and a technician receive
// `PatientPublicView`, never the clinical one.
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListPatientsQueryDto,
  ): Promise<Paginated<PatientView>> {
    return this.patientsService.list(actor, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<PatientView> {
    return this.patientsService.findOne(actor, params.id);
  }

  @Post()
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST)
  @Audit(PATIENTS_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreatePatientDto,
  ): Promise<PatientView> {
    return this.patientsService.create(actor, body);
  }

  @Patch(':id')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST)
  @Audit(PATIENTS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdatePatientDto,
  ): Promise<PatientView> {
    return this.patientsService.update(actor, params.id, body);
  }

  /** Soft delete, admin only (ROLES.md: only admin may delete). */
  @Delete(':id')
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(PATIENTS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.patientsService.softDelete(actor, params.id);
  }
}
