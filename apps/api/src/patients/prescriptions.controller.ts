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
  createPrescriptionSchema,
  idParamSchema,
  listPrescriptionsQuerySchema,
  updatePrescriptionSchema,
  USER_ROLE,
  type Paginated,
  type Prescription,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { Audit } from '@api/common/decorators/audit.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { PRESCRIPTIONS_ENTITY, PrescriptionsService } from '@api/patients/prescriptions.service';

class CreatePrescriptionDto extends createZodDto(createPrescriptionSchema) {}
class UpdatePrescriptionDto extends createZodDto(updatePrescriptionSchema) {}
class ListPrescriptionsQueryDto extends createZodDto(listPrescriptionsQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

/**
 * Prescriptions (ROLES.md patients matrix): admin CRUD, doctor CRU, and
 * nothing for technician or receptionist — a receptionist response must never
 * contain a prescription.
 */
@Controller('prescriptions')
@Roles(USER_ROLE.DOCTOR)
export class PrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListPrescriptionsQueryDto,
  ): Promise<Paginated<Prescription>> {
    return this.prescriptions.list(actor, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<Prescription> {
    return this.prescriptions.findOne(actor, params.id);
  }

  @Post()
  @Audit(PRESCRIPTIONS_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreatePrescriptionDto,
  ): Promise<Prescription> {
    return this.prescriptions.create(actor, body);
  }

  @Patch(':id')
  @Audit(PRESCRIPTIONS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdatePrescriptionDto,
  ): Promise<Prescription> {
    return this.prescriptions.update(actor, params.id, body);
  }

  @Delete(':id')
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(PRESCRIPTIONS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.prescriptions.softDelete(actor, params.id);
  }
}
