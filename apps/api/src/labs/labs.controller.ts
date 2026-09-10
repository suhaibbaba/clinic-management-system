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
  createLabSchema,
  createLabWorkTypeSchema,
  idParamSchema,
  listLabsQuerySchema,
  updateLabSchema,
  updateLabWorkTypeSchema,
  USER_ROLE,
  type Lab,
  type LabSummary,
  type LabWorkType,
  type Paginated,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { Audit } from '@api/common/decorators/audit.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { LAB_WORK_TYPES_ENTITY, LabWorkTypesService } from '@api/labs/lab-work-types.service';
import { LABS_ENTITY, LabsService } from '@api/labs/labs.service';

class CreateLabDto extends createZodDto(createLabSchema) {}
class UpdateLabDto extends createZodDto(updateLabSchema) {}
class ListLabsQueryDto extends createZodDto(listLabsQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}
class CreateWorkTypeDto extends createZodDto(createLabWorkTypeSchema) {}
class UpdateWorkTypeDto extends createZodDto(updateLabWorkTypeSchema) {}
class LabIdParamDto extends createZodDto(z.object({ labId: z.uuid() })) {}
class WorkTypeQueryDto extends createZodDto(
  z.object({ includeInactive: z.coerce.boolean().optional() }),
) {}

// Admin CRUD, technician CRU, doctor read, receptionist nothing — no route lists them, so every
// call is a 403. Deleting is admin-only: a lab carries a balance.
@Controller('labs')
export class LabsController {
  constructor(
    private readonly labs: LabsService,
    private readonly workTypes: LabWorkTypesService,
  ) {}

  @Get()
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListLabsQueryDto,
  ): Promise<Paginated<LabSummary>> {
    return this.labs.list(actor, query);
  }

  @Get(':id')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<LabSummary> {
    return this.labs.findOne(actor, params.id);
  }

  @Post()
  @Roles(USER_ROLE.TECHNICIAN)
  @Audit(LABS_ENTITY, AUDIT_ACTION.CREATE)
  create(@CurrentUser() actor: AuthenticatedUser, @Body() body: CreateLabDto): Promise<Lab> {
    return this.labs.create(actor, body);
  }

  @Patch(':id')
  @Roles(USER_ROLE.TECHNICIAN)
  @Audit(LABS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateLabDto,
  ): Promise<Lab> {
    return this.labs.update(actor, params.id, body);
  }

  @Delete(':id')
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(LABS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.labs.softDelete(actor, params.id);
  }

  @Get(':labId/work-types')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  listWorkTypes(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: LabIdParamDto,
    @Query() query: WorkTypeQueryDto,
  ): Promise<LabWorkType[]> {
    return this.workTypes.list(actor, params.labId, query.includeInactive ?? false);
  }

  @Post(':labId/work-types')
  @Roles(USER_ROLE.TECHNICIAN)
  @Audit(LAB_WORK_TYPES_ENTITY, AUDIT_ACTION.CREATE)
  createWorkType(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: LabIdParamDto,
    @Body() body: CreateWorkTypeDto,
  ): Promise<LabWorkType> {
    return this.workTypes.create(actor, params.labId, body);
  }

  @Patch('work-types/:id')
  @Roles(USER_ROLE.TECHNICIAN)
  @Audit(LAB_WORK_TYPES_ENTITY, AUDIT_ACTION.UPDATE)
  updateWorkType(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateWorkTypeDto,
  ): Promise<LabWorkType> {
    return this.workTypes.update(actor, params.id, body);
  }

  @Delete('work-types/:id')
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(LAB_WORK_TYPES_ENTITY, AUDIT_ACTION.DELETE)
  async removeWorkType(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.workTypes.softDelete(actor, params.id);
  }
}
