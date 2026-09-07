import { Global, Module } from '@nestjs/common';

import { AuditModule } from '@api/audit/audit.module';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { DatabaseModule } from '@api/database/database.module';
import { LookupsController } from '@api/lookups/lookups.controller';
import { LookupsService } from '@api/lookups/lookups.service';

/**
 * The editable choice lists.
 *
 * `@Global` because nearly every other module needs to check a code against a
 * list — an appointment's type, a payment's method, an item's unit — and
 * threading one import through eight modules would be ceremony. It is the only
 * global module in the API, and it earns that by being a leaf: it depends on
 * the database and the audit registry, and on nothing else.
 */
@Global()
@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [LookupsController],
  providers: [ClinicScopeService, LookupsService],
  exports: [LookupsService],
})
export class LookupsModule {}
