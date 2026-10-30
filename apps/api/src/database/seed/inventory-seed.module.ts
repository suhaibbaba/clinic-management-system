import { Module } from "@nestjs/common";
import { AppConfigModule } from "@api/config/config.module";
import { DatabaseModule } from "@api/database/database.module";
import { AuditModule } from "@api/modules/audit/audit.module";
import { PdfModule } from "@api/modules/billing/pdf/pdf.module";
import { EmailModule } from "@api/modules/email/email.module";
import { InventoryModule } from "@api/modules/inventory/inventory.module";
import { LookupsModule } from "@api/modules/lookups/lookups.module";
import { PermissionsModule } from "@api/modules/permissions/permissions.module";
import { StorageModule } from "@api/modules/storage/storage.module";

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    LookupsModule,
    PermissionsModule,
    AuditModule,
    StorageModule,
    EmailModule,
    PdfModule,
    InventoryModule,
  ],
})
export class InventorySeedModule {}
