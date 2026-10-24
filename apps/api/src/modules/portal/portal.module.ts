import { Module } from "@nestjs/common";
import { AppConfigModule } from "@api/config/config.module";
import { DatabaseModule } from "@api/database/database.module";
import { BillingModule } from "@api/modules/billing/billing.module";
import { NotificationsModule } from "@api/modules/notifications/notifications.module";
import { PortalController } from "@api/modules/portal/controllers/portal.controller";
import { PortalAuthService } from "@api/modules/portal/services/portal-auth.service";
import { PortalRecordsService } from "@api/modules/portal/services/portal-records.service";
import { PortalSessionGuard } from "@api/modules/portal/services/portal-session.guard";
import { StorageModule } from "@api/modules/storage/storage.module";
import { WebsiteModule } from "@api/modules/website/website.module";

@Module({
  imports: [
    DatabaseModule,
    AppConfigModule,
    BillingModule,
    NotificationsModule,
    StorageModule,
    WebsiteModule,
  ],
  controllers: [PortalController],
  providers: [PortalAuthService, PortalRecordsService, PortalSessionGuard],
})
export class PortalModule {}
