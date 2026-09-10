import { Global, Module } from '@nestjs/common';

import { AuditModule } from '@api/audit/audit.module';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { DatabaseModule } from '@api/database/database.module';
import { LookupsController } from '@api/lookups/lookups.controller';
import { LookupsService } from '@api/lookups/lookups.service';

// `@Global` because nearly every module checks a code against a list; it earns that by being a
// leaf, depending only on the database and the audit registry.
@Global()
@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [LookupsController],
  providers: [ClinicScopeService, LookupsService],
  exports: [LookupsService],
})
export class LookupsModule {}
