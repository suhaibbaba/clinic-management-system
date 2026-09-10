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
  USER_ROLE,
  createLookupOptionSchema,
  idParamSchema,
  listLookupOptionsQuerySchema,
  reorderLookupOptionsSchema,
  updateLookupOptionSchema,
  type LookupBundle,
  type LookupOption,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { Audit } from '@api/common/decorators/audit.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { LOOKUP_OPTIONS_ENTITY, LookupsService } from '@api/lookups/lookups.service';

class CreateLookupDto extends createZodDto(createLookupOptionSchema) {}
class UpdateLookupDto extends createZodDto(updateLookupOptionSchema) {}
class ReorderLookupsDto extends createZodDto(reorderLookupOptionsSchema) {}
class ListLookupsQueryDto extends createZodDto(listLookupOptionsQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

// Reading is open to every signed-in role — these are the contents of every dropdown. Writing is
// the admin's, because a list is settings.
@Controller('lookups')
export class LookupsController {
  constructor(private readonly lookups: LookupsService) {}

  /** Every list, or one. The client caches the whole bundle. */
  @Get()
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST)
  bundle(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListLookupsQueryDto,
  ): Promise<LookupBundle> {
    return this.lookups.bundle(actor, query);
  }

  @Post()
  @Roles(USER_ROLE.ADMIN)
  @Audit(LOOKUP_OPTIONS_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateLookupDto,
  ): Promise<LookupOption> {
    return this.lookups.create(actor, body);
  }

  // Before `:id`, or Nest reads "reorder" as one. A `PATCH` on the collection: ten separate writes
  // would let a refresh halfway leave a list nobody arranged.
  @Patch('reorder')
  @Roles(USER_ROLE.ADMIN)
  @Audit(LOOKUP_OPTIONS_ENTITY, AUDIT_ACTION.UPDATE)
  reorder(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: ReorderLookupsDto,
  ): Promise<LookupOption[]> {
    return this.lookups.reorder(actor, body);
  }

  @Patch(':id')
  @Roles(USER_ROLE.ADMIN)
  @Audit(LOOKUP_OPTIONS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateLookupDto,
  ): Promise<LookupOption> {
    return this.lookups.update(actor, params.id, body);
  }

  @Delete(':id')
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(LOOKUP_OPTIONS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.lookups.remove(actor, params.id);
  }
}
