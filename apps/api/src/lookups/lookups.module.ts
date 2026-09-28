import { Global, Module } from "@nestjs/common";
import { AuditModule } from "@api/audit/audit.module";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { DatabaseModule } from "@api/database/database.module";
import { LookupsController } from "@api/lookups/controllers/lookups.controller";
import { LookupsService } from "@api/lookups/services/lookups.service";

@Global()
@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [LookupsController],
  providers: [ClinicScopeService, LookupsService],
  exports: [LookupsService],
})
export class LookupsModule {}
