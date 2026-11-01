import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, Put } from "@nestjs/common";
import { CLINIC_MODULE, AUDIT_ACTION, USER_ROLE, type SupplierPayment } from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { SUPPLIER_PAYMENTS_ENTITY } from "@api/common/constants/audit-entities";
import { SupplierPaymentsService } from "@api/modules/inventory/services/supplier-payments.service";
import { SupplierAllocationsService } from "@api/modules/inventory/services/supplier-allocations.service";
import { ReallocatePaymentDto, SupplierRefundDto } from "@api/modules/inventory/dto/purchases.dto";
import {
  CreateSupplierPaymentDto,
  IdParamDto,
  ReverseSupplierPaymentDto,
} from "@api/modules/inventory/dto/supplier-payments.dto";
import { ClinicFeature } from "@api/common/decorators/clinic-feature.decorator";

@ClinicFeature(CLINIC_MODULE.INVENTORY)
@Controller("supplier-payments")
export class SupplierPaymentsController {
  constructor(
    private readonly payments: SupplierPaymentsService,
    private readonly allocations: SupplierAllocationsService,
  ) {}

  @Post("refunds")
  @Roles(USER_ROLE.ADMIN)
  @Audit(SUPPLIER_PAYMENTS_ENTITY, AUDIT_ACTION.CREATE)
  refund(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: SupplierRefundDto,
  ): Promise<SupplierPayment> {
    return this.payments.refund(actor, body);
  }

  @Put(":id/allocations")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async reallocate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ReallocatePaymentDto,
  ): Promise<void> {
    await this.allocations.reallocate(actor, params.id, body.allocations, body.reason);
  }

  @Post()
  @Roles(USER_ROLE.TECHNICIAN)
  @Audit(SUPPLIER_PAYMENTS_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateSupplierPaymentDto,
  ): Promise<SupplierPayment> {
    return this.payments.record(actor, body);
  }

  @Patch(":id/reverse")
  @Roles(USER_ROLE.ADMIN)
  @Audit(SUPPLIER_PAYMENTS_ENTITY, AUDIT_ACTION.UPDATE)
  reverse(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ReverseSupplierPaymentDto,
  ): Promise<SupplierPayment> {
    return this.payments.reverse(actor, params.id, body);
  }
}
