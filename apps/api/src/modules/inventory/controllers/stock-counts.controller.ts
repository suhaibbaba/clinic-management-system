import { Body, Controller, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { CLINIC_MODULE, USER_ROLE, type StockCount, type StockCountSummary } from "@clinic/shared";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { StockCountsService } from "@api/modules/inventory/services/stock-counts.service";
import {
  CreateStockCountDto,
  IdParamDto,
  RecordCountsDto,
} from "@api/modules/inventory/dto/stock-counts.dto";
import { ClinicFeature } from "@api/common/decorators/clinic-feature.decorator";

@ClinicFeature(CLINIC_MODULE.INVENTORY)
@Controller("stock-counts")
export class StockCountsController {
  constructor(private readonly counts: StockCountsService) {}

  @Get()
  @Roles(USER_ROLE.TECHNICIAN)
  list(@CurrentUser() actor: AuthenticatedUser): Promise<StockCountSummary[]> {
    return this.counts.list(actor);
  }

  @Post()
  @Roles(USER_ROLE.TECHNICIAN)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateStockCountDto,
  ): Promise<StockCount> {
    return this.counts.create(actor, body);
  }

  @Get(":id")
  @Roles(USER_ROLE.TECHNICIAN)
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<StockCount> {
    return this.counts.findOne(actor, params.id);
  }

  @Put(":id/lines")
  @Roles(USER_ROLE.TECHNICIAN)
  recordCounts(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: RecordCountsDto,
  ): Promise<StockCount> {
    return this.counts.recordCounts(actor, params.id, body);
  }

  @Post(":id/post")
  @Roles(USER_ROLE.ADMIN)
  post(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<StockCount> {
    return this.counts.post(actor, params.id);
  }

  @Patch(":id/cancel")
  @Roles(USER_ROLE.TECHNICIAN)
  cancel(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<StockCount> {
    return this.counts.cancel(actor, params.id);
  }
}
