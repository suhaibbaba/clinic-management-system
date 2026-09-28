import { Module } from "@nestjs/common";
import { ClinicsController } from "@api/clinics/controllers/clinics.controller";
import { ClinicsService } from "@api/clinics/services/clinics.service";
import { MapLinkResolver } from "@api/clinics/services/map-link.resolver";

@Module({
  controllers: [ClinicsController],
  providers: [ClinicsService, MapLinkResolver],
  exports: [ClinicsService],
})
export class ClinicsModule {}
