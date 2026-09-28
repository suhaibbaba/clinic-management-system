import { Global, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";
import { CapabilityRegistry } from "@api/permissions/services/capability-registry.service";
import { PermissionsController } from "@api/permissions/controllers/permissions.controller";
import { PermissionsService } from "@api/permissions/services/permissions.service";

@Global()
@Module({
  imports: [DiscoveryModule],
  controllers: [PermissionsController],
  providers: [CapabilityRegistry, PermissionsService],
  exports: [CapabilityRegistry, PermissionsService],
})
export class PermissionsModule {}
