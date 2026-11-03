import { Module } from "@nestjs/common";
import { AppointmentsModule } from "@api/modules/appointments/appointments.module";
import { BillingModule } from "@api/modules/billing/billing.module";
import { DashboardController } from "@api/modules/dashboard/controllers/dashboard.controller";
import { DashboardService } from "@api/modules/dashboard/services/dashboard.service";
import { DashboardActivityService } from "@api/modules/dashboard/services/dashboard-activity.service";
import { DashboardLayoutsService } from "@api/modules/dashboard/services/dashboard-layouts.service";

@Module({
  imports: [AppointmentsModule, BillingModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardLayoutsService, DashboardActivityService],
})
export class DashboardModule {}
