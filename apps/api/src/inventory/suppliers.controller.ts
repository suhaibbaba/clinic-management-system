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
  createSupplierSchema,
  idParamSchema,
  listSuppliersQuerySchema,
  statementRangeQuerySchema,
  updateSupplierSchema,
  type Paginated,
  type Supplier,
  type SupplierStatement,
  type SupplierSummary,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { Audit } from '@api/common/decorators/audit.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { InventoryReportsService } from '@api/inventory/inventory-reports.service';
import { SUPPLIERS_ENTITY, SuppliersService } from '@api/inventory/suppliers.service';

class CreateSupplierDto extends createZodDto(createSupplierSchema) {}
class UpdateSupplierDto extends createZodDto(updateSupplierSchema) {}
class ListSuppliersQueryDto extends createZodDto(listSuppliersQuerySchema) {}
class StatementQueryDto extends createZodDto(statementRangeQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

/**
 * Who the clinic buys from (ROLES.md inventory matrix, "Items & suppliers").
 *
 * Admin CRUD, technician create-read-update — buying is their job and so is
 * keeping the list current — doctor read, receptionist nothing. Deleting is
 * admin-only for the same reason it is on a lab: a supplier carries purchase
 * history, and taking them out of the directory is a financial decision.
 */
@Controller('suppliers')
export class SuppliersController {
  constructor(
    private readonly suppliers: SuppliersService,
    private readonly reports: InventoryReportsService,
  ) {}

  @Get()
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListSuppliersQueryDto,
  ): Promise<Paginated<SupplierSummary>> {
    return this.suppliers.list(actor, query);
  }

  @Get(':id')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<SupplierSummary> {
    return this.suppliers.findOne(actor, params.id);
  }

  /** Everything bought from them in a period, with what it cost. */
  @Get(':id/statement')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  statement(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Query() query: StatementQueryDto,
  ): Promise<SupplierStatement> {
    return this.reports.supplierStatement(actor, params.id, query);
  }

  @Post()
  @Roles(USER_ROLE.TECHNICIAN)
  @Audit(SUPPLIERS_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateSupplierDto,
  ): Promise<Supplier> {
    return this.suppliers.create(actor, body);
  }

  @Patch(':id')
  @Roles(USER_ROLE.TECHNICIAN)
  @Audit(SUPPLIERS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateSupplierDto,
  ): Promise<Supplier> {
    return this.suppliers.update(actor, params.id, body);
  }

  @Delete(':id')
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(SUPPLIERS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.suppliers.softDelete(actor, params.id);
  }
}
