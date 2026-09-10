import { Global, Module } from '@nestjs/common';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { AuditController } from '@api/audit/audit.controller';
import { AuditService } from '@api/audit/audit.service';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditSnapshotRegistry],
  exports: [AuditService, AuditSnapshotRegistry],
})
export class AuditModule {}
