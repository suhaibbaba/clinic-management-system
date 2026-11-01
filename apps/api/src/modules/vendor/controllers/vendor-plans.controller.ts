import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { Paginated, Plan } from "@clinic/shared";
import { Public } from "@api/common/decorators/public.decorator";
import { PlansQueryDto, SavePlanDto, VendorIdParamDto } from "@api/modules/vendor/dto/vendor.dto";
import { VendorSession, type VendorSessionContext } from "@api/modules/vendor/lib/vendor-session";
import { PlansService } from "@api/modules/vendor/services/plans.service";
import { VendorSessionGuard } from "@api/modules/vendor/services/vendor-session.guard";

@Controller("vendor/plans")
@Public()
@UseGuards(VendorSessionGuard)
export class VendorPlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  list(@Query() query: PlansQueryDto): Promise<Paginated<Plan>> {
    return this.plans.list(query);
  }

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  create(@Body() body: SavePlanDto, @VendorSession() session: VendorSessionContext): Promise<void> {
    return this.plans.create(body, session.vendorUserId);
  }

  @Patch(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  update(
    @Param() params: VendorIdParamDto,
    @Body() body: SavePlanDto,
    @VendorSession() session: VendorSessionContext,
  ): Promise<void> {
    return this.plans.update(params.id, body, session.vendorUserId);
  }
}
