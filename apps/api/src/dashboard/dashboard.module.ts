import { Module } from "@nestjs/common";
import { AppointmentsModule } from "@api/appointments/appointments.module";
import { BillingModule } from "@api/billing/billing.module";
import { DashboardController } from "@api/dashboard/controllers/dashboard.controller";
import { DashboardService } from "@api/dashboard/services/dashboard.service";

@Module({
  imports: [AppointmentsModule, BillingModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
