import { Body, Controller, Get, Header, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { USER_ROLE, type Paginated, type PurchaseRequest } from "@clinic/shared";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { PurchaseRequestsService } from "@api/modules/inventory/services/purchase-requests.service";
import { InventoryDocumentsService } from "@api/modules/inventory/services/inventory-documents.service";
import {
  CancelPurchaseRequestDto,
  CreatePurchaseRequestDto,
  IdParamDto,
  ListPurchaseRequestsQueryDto,
  RequestBelowMinimumDto,
  SendPurchaseRequestDto,
  UpdatePurchaseRequestDto,
} from "@api/modules/inventory/dto/purchase-requests.dto";

@Controller("purchase-requests")
export class PurchaseRequestsController {
  constructor(
    private readonly requests: PurchaseRequestsService,
    private readonly documents: InventoryDocumentsService,
  ) {}

  @Get()
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListPurchaseRequestsQueryDto,
  ): Promise<Paginated<PurchaseRequest>> {
    return this.requests.list(actor, query);
  }

  @Post()
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreatePurchaseRequestDto,
  ): Promise<PurchaseRequest> {
    return this.requests.create(actor, body);
  }

  @Post("below-minimum")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  fromBelowMinimum(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: RequestBelowMinimumDto,
  ): Promise<PurchaseRequest[]> {
    return this.requests.fromBelowMinimum(actor, body.supplierId);
  }

  @Get(":id")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<PurchaseRequest> {
    return this.requests.findOne(actor, params.id);
  }

  @Get(":id/pdf")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Header("Content-Type", "application/pdf")
  @Header("Content-Disposition", 'inline; filename="purchase-request.pdf"')
  async pdf(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<Buffer> {
    return this.documents.purchaseRequest(
      actor,
      await this.requests.findOne(actor, params.id),
      false,
    );
  }

  @Put(":id")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdatePurchaseRequestDto,
  ): Promise<PurchaseRequest> {
    return this.requests.update(actor, params.id, body);
  }

  @Post(":id/send")
  @Roles(USER_ROLE.TECHNICIAN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  send(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: SendPurchaseRequestDto,
  ): Promise<PurchaseRequest> {
    return this.requests.send(actor, params.id, body);
  }

  @Patch(":id/ordered")
  @Roles(USER_ROLE.TECHNICIAN)
  markOrdered(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<PurchaseRequest> {
    return this.requests.markOrdered(actor, params.id);
  }

  @Patch(":id/close")
  @Roles(USER_ROLE.TECHNICIAN)
  close(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<PurchaseRequest> {
    return this.requests.close(actor, params.id);
  }

  @Patch(":id/cancel")
  @Roles(USER_ROLE.TECHNICIAN)
  cancel(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: CancelPurchaseRequestDto,
  ): Promise<PurchaseRequest> {
    return this.requests.cancel(actor, params.id, body.reason);
  }
}
