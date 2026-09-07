import { Module } from '@nestjs/common';

import { HealthController, VersionController } from '@api/health/health.controller';
import { HealthService } from '@api/health/health.service';

@Module({
  controllers: [HealthController, VersionController],
  providers: [HealthService],
})
export class HealthModule {}
