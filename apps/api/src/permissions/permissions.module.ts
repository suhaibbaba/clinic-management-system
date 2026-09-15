import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { CapabilityRegistry } from '@api/permissions/capability-registry.service';
import { PermissionsController } from '@api/permissions/permissions.controller';
import { PermissionsService } from '@api/permissions/permissions.service';

@Global()
@Module({
  imports: [DiscoveryModule],
  controllers: [PermissionsController],
  providers: [CapabilityRegistry, PermissionsService],
  exports: [CapabilityRegistry, PermissionsService],
})
export class PermissionsModule {}
