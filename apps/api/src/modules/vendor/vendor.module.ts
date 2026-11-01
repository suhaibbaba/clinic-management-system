import { Module } from "@nestjs/common";
import { AuthModule } from "@api/modules/auth/auth.module";
import { VendorAuthController } from "@api/modules/vendor/controllers/vendor-auth.controller";
import { VendorClinicsController } from "@api/modules/vendor/controllers/vendor-clinics.controller";
import { VendorPlansController } from "@api/modules/vendor/controllers/vendor-plans.controller";
import { PlansService } from "@api/modules/vendor/services/plans.service";
import { SubscriptionExpiryScheduler } from "@api/modules/vendor/services/subscription-expiry.scheduler";
import { SubscriptionsService } from "@api/modules/vendor/services/subscriptions.service";
import { VendorAuthService } from "@api/modules/vendor/services/vendor-auth.service";
import { VendorClinicsService } from "@api/modules/vendor/services/vendor-clinics.service";
import { VendorSessionGuard } from "@api/modules/vendor/services/vendor-session.guard";

@Module({
  imports: [AuthModule],
  controllers: [VendorAuthController, VendorClinicsController, VendorPlansController],
  providers: [
    VendorAuthService,
    VendorSessionGuard,
    SubscriptionsService,
    PlansService,
    VendorClinicsService,
    SubscriptionExpiryScheduler,
  ],
})
export class VendorModule {}
