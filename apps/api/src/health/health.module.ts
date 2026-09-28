import { Module } from "@nestjs/common";
import { HealthController, VersionController } from "@api/health/controllers/health.controller";
import { HealthService } from "@api/health/services/health.service";

@Module({
  controllers: [HealthController, VersionController],
  providers: [HealthService],
})
export class HealthModule {}
