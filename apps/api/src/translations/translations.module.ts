import { Module } from "@nestjs/common";
import { AuditModule } from "@api/audit/audit.module";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { DatabaseModule } from "@api/database/database.module";
import { TranslationsController } from "@api/translations/translations.controller";
import { TranslationsService } from "@api/translations/translations.service";

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [TranslationsController],
  providers: [ClinicScopeService, TranslationsService],
  exports: [TranslationsService],
})
export class TranslationsModule {}
