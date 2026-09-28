import { Global, Module } from "@nestjs/common";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { AuditController } from "@api/modules/audit/controllers/audit.controller";
import { AuditService } from "@api/modules/audit/services/audit.service";

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditSnapshotRegistry],
  exports: [AuditService, AuditSnapshotRegistry],
})
export class AuditModule {}
