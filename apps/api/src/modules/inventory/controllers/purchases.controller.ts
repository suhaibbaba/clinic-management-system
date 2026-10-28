import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import { USER_ROLE, type PurchaseResult, type SupplierInvoiceSummary } from "@clinic/shared";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { PurchasingService } from "@api/modules/inventory/services/purchasing.service";
import {
  IdParamDto,
  InvoiceReceiptsDto,
  PostPurchaseDto,
  VoidDocumentDto,
} from "@api/modules/inventory/dto/purchases.dto";

@Controller("purchases")
export class PurchasesController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Post()
  @Roles(USER_ROLE.TECHNICIAN)
  post(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: PostPurchaseDto,
  ): Promise<PurchaseResult> {
    return this.purchasing.post(actor, body);
  }

  @Post("invoices")
  @Roles(USER_ROLE.TECHNICIAN)
  invoiceReceipts(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: InvoiceReceiptsDto,
  ): Promise<SupplierInvoiceSummary> {
    return this.purchasing.invoiceReceipts(actor, body);
  }

  @Patch("invoices/:id/void")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async voidInvoice(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: VoidDocumentDto,
  ): Promise<void> {
    await this.purchasing.voidInvoice(actor, params.id, body.reason);
  }

  @Patch("receipts/:id/void")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async voidReceipt(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: VoidDocumentDto,
  ): Promise<void> {
    await this.purchasing.voidReceipt(actor, params.id, body.reason);
  }
}
