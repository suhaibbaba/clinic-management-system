import { Module } from "@nestjs/common";
import { AppointmentsModule } from "@api/modules/appointments/appointments.module";
import { BillingModule } from "@api/modules/billing/billing.module";
import { DashboardController } from "@api/modules/dashboard/controllers/dashboard.controller";
import { DashboardService } from "@api/modules/dashboard/services/dashboard.service";

@Module({
  imports: [AppointmentsModule, BillingModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
