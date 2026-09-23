import { Controller, Get } from "@nestjs/common";
import type { DashboardSummary } from "@clinic/shared";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DashboardService } from "@api/dashboard/dashboard.service";
import { AiTool } from "@api/ai/tools/route-tool.decorator";

// No `@Roles`: every role has a dashboard row, and what differs is which figures the response
// carries — the service's job, not a door to lock.
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @AiTool({
    group: "reports",
    description:
      "Today at a glance, as the dashboard shows it to this role: appointments, pending bookings, balances due. Returns the summary.",
  })
  @Get("summary")
  summary(@CurrentUser() actor: AuthenticatedUser): Promise<DashboardSummary> {
    return this.dashboard.summary(actor);
  }
}
