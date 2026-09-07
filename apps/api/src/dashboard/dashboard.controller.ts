import { Controller, Get } from '@nestjs/common';
import type { DashboardSummary } from '@clinic/shared';

import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DashboardService } from '@api/dashboard/dashboard.service';

/**
 * The landing page, in one request.
 *
 * No `@Roles`: every role has a dashboard row in ROLES.md, and what differs
 * between them is *which figures the response carries*, which is the service's
 * job and not a door to be locked. A read-only aggregate of things the caller
 * may already read is not a new permission.
 */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(@CurrentUser() actor: AuthenticatedUser): Promise<DashboardSummary> {
    return this.dashboard.summary(actor);
  }
}
