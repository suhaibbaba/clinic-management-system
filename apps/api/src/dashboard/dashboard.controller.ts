import { Controller, Get } from '@nestjs/common';
import type { DashboardSummary } from '@clinic/shared';

import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DashboardService } from '@api/dashboard/dashboard.service';

// No `@Roles`: every role has a dashboard row, and what differs is which figures the response
// carries — the service's job, not a door to lock.
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(@CurrentUser() actor: AuthenticatedUser): Promise<DashboardSummary> {
    return this.dashboard.summary(actor);
  }
}
