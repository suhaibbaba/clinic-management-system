import { Module } from '@nestjs/common';

import { AppointmentsModule } from '@api/appointments/appointments.module';
import { BillingModule } from '@api/billing/billing.module';
import { DashboardController } from '@api/dashboard/dashboard.controller';
import { DashboardService } from '@api/dashboard/dashboard.service';

// Owns no table and no query: it imports the modules that already answer these, so a card and the
// page it links to cannot disagree.
@Module({
  imports: [AppointmentsModule, BillingModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
