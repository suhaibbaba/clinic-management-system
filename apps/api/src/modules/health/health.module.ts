import { Module } from "@nestjs/common";
import { HealthController, VersionController } from "@api/modules/health/controllers/health.controller";
import { HealthService } from "@api/modules/health/services/health.service";

@Module({
  controllers: [HealthController, VersionController],
  providers: [HealthService],
})
export class HealthModule {}
