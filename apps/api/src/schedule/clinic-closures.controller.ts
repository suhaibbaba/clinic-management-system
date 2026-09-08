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
  createClinicClosureSchema,
  idParamSchema,
  listClinicClosuresQuerySchema,
  scheduleConflictOptionsSchema,
  updateClinicClosureSchema,
  USER_ROLE,
  type ClinicClosure,
  type ClinicClosureResult,
  type Paginated,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { Audit } from '@api/common/decorators/audit.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import {
  CLINIC_CLOSURES_ENTITY,
  ClinicClosuresService,
} from '@api/schedule/clinic-closures.service';

class CreateClinicClosureDto extends createZodDto(createClinicClosureSchema) {}
class UpdateClinicClosureDto extends createZodDto(updateClinicClosureSchema) {}
class ListClinicClosuresQueryDto extends createZodDto(listClinicClosuresQuerySchema) {}
class ConflictOptionsDto extends createZodDto(scheduleConflictOptionsSchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

/**
 * Clinic closures (ROLES.md core matrix, "Clinic settings"): every role reads,
 * only admin writes.
 *
 * Reading is deliberately open. A receptionist who cannot see that the clinic
 * is shut next Tuesday will book into it, and the calendar they book from
 * draws the shading from exactly this list.
 *
 * `force` and `cancelAppointments` are query parameters rather than body
 * fields because they are not part of the closure — they are what the caller
 * decided about the 409 they were shown, and a closure that stored "I was
 * forced" would be recording an interaction rather than a fact.
 */
@Controller('clinic-closures')
export class ClinicClosuresController {
  constructor(private readonly closures: ClinicClosuresService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListClinicClosuresQueryDto,
  ): Promise<Paginated<ClinicClosure>> {
    return this.closures.list(actor, query);
  }

  @Post()
  @Roles(USER_ROLE.ADMIN)
  @Audit(CLINIC_CLOSURES_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: 'response' })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateClinicClosureDto,
    @Query() options: ConflictOptionsDto,
  ): Promise<ClinicClosureResult> {
    return this.closures.create(actor, body, options);
  }

  @Patch(':id')
  @Roles(USER_ROLE.ADMIN)
  @Audit(CLINIC_CLOSURES_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateClinicClosureDto,
    @Query() options: ConflictOptionsDto,
  ): Promise<ClinicClosureResult> {
    return this.closures.update(actor, params.id, body, options);
  }

  @Delete(':id')
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(CLINIC_CLOSURES_ENTITY, AUDIT_ACTION.DELETE)
  async remove(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<void> {
    await this.closures.softDelete(actor, params.id);
  }
}
