import { Module } from '@nestjs/common';

import { AppointmentsModule } from '@api/appointments/appointments.module';
import { BillingModule } from '@api/billing/billing.module';
import { DashboardController } from '@api/dashboard/dashboard.controller';
import { DashboardService } from '@api/dashboard/dashboard.service';

/**
 * The landing page's aggregate (CLAUDE.md module 9, the first slice of it).
 *
 * It owns no table and no query of its own — it imports the modules that
 * already answer these questions, so the card and the page it links to can
 * never disagree.
 */
@Module({
  imports: [AppointmentsModule, BillingModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
