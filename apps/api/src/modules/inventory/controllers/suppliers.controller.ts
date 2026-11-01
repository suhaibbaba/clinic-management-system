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
} from "@nestjs/common";
import {
  CLINIC_MODULE,
  AUDIT_ACTION,
  USER_ROLE,
  type Paginated,
  type Supplier,
  type SupplierInvoiceSummary,
  type SupplierStatement,
  type UninvoicedLine,
  type SupplierSummary,
} from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { InventoryReportsService } from "@api/modules/inventory/services/inventory-reports.service";
import { SUPPLIERS_ENTITY } from "@api/common/constants/audit-entities";
import { SuppliersService } from "@api/modules/inventory/services/suppliers.service";
import { PurchasingService } from "@api/modules/inventory/services/purchasing.service";
import { AiTool } from "@api/modules/ai/tools/route-tool.decorator";
import {
  ListSuppliersQueryDto,
  IdParamDto,
  StatementQueryDto,
  CreateSupplierDto,
  UpdateSupplierDto,
} from "@api/modules/inventory/dto/suppliers.dto";
import { ClinicFeature } from "@api/common/decorators/clinic-feature.decorator";

@ClinicFeature(CLINIC_MODULE.INVENTORY)
@Controller("suppliers")
export class SuppliersController {
  constructor(
    private readonly suppliers: SuppliersService,
    private readonly reports: InventoryReportsService,
    private readonly purchasing: PurchasingService,
  ) {}

  @AiTool({
    group: "inventory",
    description:
      "The clinic's suppliers by name, each with purchased, paid and the balance still owed. Use to find a supplierId.",
  })
  @Get()
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListSuppliersQueryDto,
  ): Promise<Paginated<SupplierSummary>> {
    return this.suppliers.list(actor, query);
  }

  @AiTool({
    group: "inventory",
    description: "One supplier with their contact.",
  })
  @Get(":id")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<SupplierSummary> {
    return this.suppliers.findOne(actor, params.id);
  }

  @AiTool({
    group: "inventory",
    description:
      "One supplier's account over dates: opening balance, purchases and payments, and what is still owed.",
  })
  @Get(":id/statement")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  statement(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Query() query: StatementQueryDto,
  ): Promise<SupplierStatement> {
    return this.reports.supplierStatement(actor, params.id, query);
  }

  @Get(":id/invoices")
  @Roles(USER_ROLE.TECHNICIAN)
  invoices(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<SupplierInvoiceSummary[]> {
    return this.purchasing.listInvoices(actor, params.id);
  }

  @Get(":id/uninvoiced")
  @Roles(USER_ROLE.TECHNICIAN)
  uninvoiced(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<UninvoicedLine[]> {
    return this.purchasing.uninvoiced(actor, params.id);
  }

  @AiTool({
    group: "inventory",
    description: "Add a supplier. Waits on a card.",
  })
  @Post()
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Audit(SUPPLIERS_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateSupplierDto,
  ): Promise<Supplier> {
    return this.suppliers.create(actor, body);
  }

  @AiTool({
    group: "inventory",
    description: "Change a supplier's details, or switch them off. Waits on a card.",
  })
  @Patch(":id")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Audit(SUPPLIERS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateSupplierDto,
  ): Promise<Supplier> {
    return this.suppliers.update(actor, params.id, body);
  }

  @AiTool({
    group: "inventory",
    description: "Archive a supplier. Waits on a typed confirmation.",
  })
  @Delete(":id")
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
