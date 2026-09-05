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
  createPerformedProcedureSchema,
  idParamSchema,
  listPerformedProceduresQuerySchema,
  updatePerformedProcedureSchema,
  USER_ROLE,
  type Paginated,
  type PerformedProcedure,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { Audit } from '@api/common/decorators/audit.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { PERFORMED_PROCEDURES_ENTITY, ProceduresService } from '@api/patients/procedures.service';

class CreateProcedureDto extends createZodDto(createPerformedProcedureSchema) {}
class UpdateProcedureDto extends createZodDto(updatePerformedProcedureSchema) {}
class ListProceduresQueryDto extends createZodDto(listPerformedProceduresQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

/**
 * Performed procedures & chart marks (ROLES.md patients matrix): admin CRUD,
 * doctor CRU, technician read of lab-linked rows only, receptionist nothing.
 *
 * Recording a procedure is what makes a patient owe money, so every mutation
 * is audited and hands the billing seam an event.
 */
@Controller('performed-procedures')
@Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
export class ProceduresController {
  constructor(private readonly procedures: ProceduresService) {}

  /** A technician's page is filtered to lab-linked rows inside the service. */
  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListProceduresQueryDto,
  ): Promise<Paginated<PerformedProcedure>> {
    return this.procedures.list(actor, query);
  }

  @Get(':id')
  @Roles(USER_ROLE.DOCTOR)
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<PerformedProcedure> {
    return this.procedures.findOne(actor, params.id);
  }

  @Post()
  @Roles(USER_ROLE.DOCTOR)
  @Audit(PERFORMED_PROCEDURES_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateProcedureDto,
  ): Promise<PerformedProcedure> {
    return this.procedures.create(actor, body);
  }

  @Patch(':id')
  @Roles(USER_ROLE.DOCTOR)
  @Audit(PERFORMED_PROCEDURES_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateProcedureDto,
  ): Promise<PerformedProcedure> {
    return this.procedures.update(actor, params.id, body);
  }

  @Delete(':id')
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(PERFORMED_PROCEDURES_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.procedures.softDelete(actor, params.id);
  }
}
