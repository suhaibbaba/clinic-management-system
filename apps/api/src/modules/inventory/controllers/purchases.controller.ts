import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import {
  CLINIC_MODULE,
  USER_ROLE,
  type PurchaseResult,
  type PurchaseReviewEntry,
  type SupplierInvoiceSummary,
  type SupplierReturnResult,
} from "@clinic/shared";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { PurchasingService } from "@api/modules/inventory/services/purchasing.service";
import { SupplierCreditsService } from "@api/modules/inventory/services/supplier-credits.service";
import { PurchaseReviewService } from "@api/modules/inventory/services/purchase-review.service";
import {
  IdParamDto,
  InvoiceReceiptsDto,
  MarkReviewedDto,
  PostPurchaseDto,
  PriceDocumentDto,
  SupplierReturnDto,
  VoidDocumentDto,
} from "@api/modules/inventory/dto/purchases.dto";
import { ClinicFeature } from "@api/common/decorators/clinic-feature.decorator";

@ClinicFeature(CLINIC_MODULE.INVENTORY)
@Controller("purchases")
export class PurchasesController {
  constructor(
    private readonly purchasing: PurchasingService,
    private readonly credits: SupplierCreditsService,
    private readonly review: PurchaseReviewService,
  ) {}

  @Get("review")
  @Roles(USER_ROLE.ADMIN)
  reviewList(@CurrentUser() actor: AuthenticatedUser): Promise<PurchaseReviewEntry[]> {
    return this.review.pending(actor);
  }

  @Patch("review")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async markReviewed(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: MarkReviewedDto,
  ): Promise<void> {
    await this.review.markReviewed(actor, body);
  }

  @Post("returns")
  @Roles(USER_ROLE.TECHNICIAN)
  returnToSupplier(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: SupplierReturnDto,
  ): Promise<SupplierReturnResult> {
    return this.credits.returnToSupplier(actor, body);
  }

  @Patch("returns/:id/void")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async voidReturn(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: VoidDocumentDto,
  ): Promise<void> {
    await this.credits.voidReturn(actor, params.id, body.reason);
  }

  @Post("credit-notes")
  @Roles(USER_ROLE.ADMIN)
  creditNote(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: PriceDocumentDto,
  ): Promise<SupplierInvoiceSummary> {
    return this.credits.creditNote(actor, body);
  }

  @Post("supplementary")
  @Roles(USER_ROLE.ADMIN)
  supplementary(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: PriceDocumentDto,
  ): Promise<SupplierInvoiceSummary> {
    return this.credits.supplementary(actor, body);
  }

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
