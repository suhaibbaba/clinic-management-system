import { Body, Controller, Get, Put } from "@nestjs/common";
import {
  USER_ROLE,
  type DashboardCollections,
  type DashboardLayout,
  type DashboardLayouts,
  type DashboardSummary,
  type DashboardVisits,
} from "@clinic/shared";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DashboardService } from "@api/modules/dashboard/services/dashboard.service";
import { DashboardActivityService } from "@api/modules/dashboard/services/dashboard-activity.service";
import { DashboardLayoutsService } from "@api/modules/dashboard/services/dashboard-layouts.service";
import { SaveDashboardLayoutsDto } from "@api/modules/dashboard/dto/dashboard-layouts.dto";
import { AiTool } from "@api/modules/ai/tools/route-tool.decorator";

@Controller("dashboard")
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly layouts: DashboardLayoutsService,
    private readonly activity: DashboardActivityService,
  ) {}

  @AiTool({
    group: "reports",
    description:
      "Today at a glance, as the dashboard shows it to this role: appointments, pending bookings, balances due. Returns the summary.",
  })
  @Get("summary")
  summary(@CurrentUser() actor: AuthenticatedUser): Promise<DashboardSummary> {
    return this.dashboard.summary(actor);
  }

  @Get("visits-today")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR, USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST)
  visitsToday(@CurrentUser() actor: AuthenticatedUser): Promise<DashboardVisits> {
    return this.activity.visitsToday(actor);
  }

  @Get("collections")
  @Roles(USER_ROLE.RECEPTIONIST)
  collections(@CurrentUser() actor: AuthenticatedUser): Promise<DashboardCollections> {
    return this.activity.collections(actor.clinicId);
  }

  @Get("layout")
  layout(@CurrentUser() actor: AuthenticatedUser): Promise<DashboardLayout> {
    return this.layouts.forUser(actor);
  }

  @Get("layouts")
  @Roles(USER_ROLE.ADMIN)
  layoutsByRole(@CurrentUser() actor: AuthenticatedUser): Promise<DashboardLayouts> {
    return this.layouts.list(actor.clinicId);
  }

  @Put("layouts")
  @Roles(USER_ROLE.ADMIN)
  saveLayouts(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: SaveDashboardLayoutsDto,
  ): Promise<DashboardLayouts> {
    return this.layouts.save(actor, body);
  }
}
