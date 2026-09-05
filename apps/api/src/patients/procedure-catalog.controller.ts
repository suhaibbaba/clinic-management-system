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
  createProcedureCatalogItemSchema,
  idParamSchema,
  listProcedureCatalogQuerySchema,
  updateProcedureCatalogItemSchema,
  USER_ROLE,
  type Paginated,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { Audit } from '@api/common/decorators/audit.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import {
  PROCEDURE_CATALOG_ENTITY,
  ProcedureCatalogService,
  type CatalogView,
} from '@api/patients/procedure-catalog.service';

class CreateCatalogItemDto extends createZodDto(createProcedureCatalogItemSchema) {}
class UpdateCatalogItemDto extends createZodDto(updateProcedureCatalogItemSchema) {}
class ListCatalogQueryDto extends createZodDto(listProcedureCatalogQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

/**
 * Procedure catalog (ROLES.md core matrix): admin CRUD, every other role reads,
 * and a receptionist receives names and prices only — the narrowing happens in
 * the service, by role.
 */
@Controller('procedure-catalog')
export class ProcedureCatalogController {
  constructor(private readonly catalog: ProcedureCatalogService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListCatalogQueryDto,
  ): Promise<Paginated<CatalogView>> {
    return this.catalog.list(actor, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<CatalogView> {
    return this.catalog.findOne(actor, params.id);
  }

  @Post()
  @Roles(USER_ROLE.ADMIN)
  @Audit(PROCEDURE_CATALOG_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateCatalogItemDto,
  ): Promise<CatalogView> {
    return this.catalog.create(actor, body);
  }

  @Patch(':id')
  @Roles(USER_ROLE.ADMIN)
  @Audit(PROCEDURE_CATALOG_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateCatalogItemDto,
  ): Promise<CatalogView> {
    return this.catalog.update(actor, params.id, body);
  }

  @Delete(':id')
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(PROCEDURE_CATALOG_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.catalog.softDelete(actor, params.id);
  }
}
