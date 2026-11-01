import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import type {
  Paginated,
  VendorClinicDetail,
  VendorClinicSummary,
  VendorOverview,
  CreatedClinic,
} from "@clinic/shared";
import { Public } from "@api/common/decorators/public.decorator";
import {
  CreateClinicDto,
  GrantSpecialtyDto,
  SaveClinicDomainDto,
  VendorIdParamDto,
  SaveSubscriptionDto,
  VendorClinicsQueryDto,
} from "@api/modules/vendor/dto/vendor.dto";
import { VendorSession, type VendorSessionContext } from "@api/modules/vendor/lib/vendor-session";
import { SubscriptionsService } from "@api/modules/vendor/services/subscriptions.service";
import { ClinicLifecycleService } from "@api/modules/vendor/services/clinic-lifecycle.service";
import { VendorClinicsService } from "@api/modules/vendor/services/vendor-clinics.service";
import { VendorSessionGuard } from "@api/modules/vendor/services/vendor-session.guard";

@Controller("vendor")
@Public()
@UseGuards(VendorSessionGuard)
export class VendorClinicsController {
  constructor(
    private readonly clinics: VendorClinicsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly lifecycle: ClinicLifecycleService,
  ) {}

  @Get("overview")
  overview(): Promise<VendorOverview> {
    return this.clinics.overview();
  }

  @Get("clinics")
  list(@Query() query: VendorClinicsQueryDto): Promise<Paginated<VendorClinicSummary>> {
    return this.clinics.list(query);
  }

  @Post("clinics")
  create(
    @Body() body: CreateClinicDto,
    @VendorSession() session: VendorSessionContext,
  ): Promise<CreatedClinic> {
    return this.lifecycle.create(body, session.vendorUserId);
  }

  @Delete("clinics/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param() params: VendorIdParamDto,
    @VendorSession() session: VendorSessionContext,
  ): Promise<void> {
    return this.lifecycle.remove(params.id, session.vendorUserId);
  }

  @Post("clinics/:id/restore")
  @HttpCode(HttpStatus.NO_CONTENT)
  restore(
    @Param() params: VendorIdParamDto,
    @VendorSession() session: VendorSessionContext,
  ): Promise<void> {
    return this.lifecycle.restore(params.id, session.vendorUserId);
  }

  @Get("clinics/:id")
  detail(@Param() params: VendorIdParamDto): Promise<VendorClinicDetail> {
    return this.clinics.detail(params.id);
  }

  @Put("clinics/:id/subscription")
  @HttpCode(HttpStatus.NO_CONTENT)
  saveSubscription(
    @Param() params: VendorIdParamDto,
    @Body() body: SaveSubscriptionDto,
    @VendorSession() session: VendorSessionContext,
  ): Promise<void> {
    return this.subscriptions.save(params.id, body, session.vendorUserId);
  }

  @Put("clinics/:id/domain")
  @HttpCode(HttpStatus.NO_CONTENT)
  saveDomain(
    @Param() params: VendorIdParamDto,
    @Body() body: SaveClinicDomainDto,
    @VendorSession() session: VendorSessionContext,
  ): Promise<void> {
    return this.clinics.saveDomain(params.id, body.domain, session.vendorUserId);
  }

  @Post("clinics/:id/specialties")
  @HttpCode(HttpStatus.NO_CONTENT)
  grantSpecialty(
    @Param() params: VendorIdParamDto,
    @Body() body: GrantSpecialtyDto,
    @VendorSession() session: VendorSessionContext,
  ): Promise<void> {
    return this.clinics.grantSpecialty(params.id, body.code, session.vendorUserId);
  }
}
