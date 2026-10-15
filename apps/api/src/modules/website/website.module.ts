import { Module } from "@nestjs/common";
import { AuditModule } from "@api/modules/audit/audit.module";
import { ClinicsModule } from "@api/modules/clinics/clinics.module";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { DatabaseModule } from "@api/database/database.module";
import { StorageModule } from "@api/modules/storage/storage.module";
import { PublicSiteController } from "@api/modules/website/controllers/public-site.controller";
import { WebsiteController } from "@api/modules/website/controllers/website.controller";
import { WebsiteMessagesController } from "@api/modules/website/controllers/website-messages.controller";
import { ContactMessagesService } from "@api/modules/website/services/contact-messages.service";
import { WebsiteService } from "@api/modules/website/services/website.service";

@Module({
  imports: [DatabaseModule, AuditModule, StorageModule, ClinicsModule],
  controllers: [WebsiteController, WebsiteMessagesController, PublicSiteController],
  providers: [ClinicScopeService, WebsiteService, ContactMessagesService],
})
export class WebsiteModule {}
